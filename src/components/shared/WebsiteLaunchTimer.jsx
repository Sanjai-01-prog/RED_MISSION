import React, { useState, useEffect } from 'react';
import { Clock, Radio } from 'lucide-react';
import { siteConfigApi } from '../../services/api';
import { getStaticLaunchConfig, resolveLaunchRuntimeConfig } from '../../config/launchConfig';
import {
  ZERO_ELAPSED,
  ensureTemporal,
  calculateElapsedTime,
  formatDurationForScreenReader,
  formatLaunchTimestampDisplay
} from '../../utils/launchTimer';

function formatTwoDigits(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, '0');
}

export default function WebsiteLaunchTimer({
  staticConfigOverride = null,
  fetchLaunchConfig = siteConfigApi.getLaunchConfig,
  locationPortOverride = undefined,
  className = ''
}) {
  // Always initially display 00 Days : 00 Hours : 00 Minutes : 00 Seconds
  const [elapsed, setElapsed] = useState(ZERO_ELAPSED);
  const [statusMeta, setStatusMeta] = useState(() => {
    const staticConfig = staticConfigOverride || getStaticLaunchConfig();
    const initialRuntime = resolveLaunchRuntimeConfig({
      staticConfig,
      backendConfig: null,
      locationPort: locationPortOverride
    });
    return {
      status: initialRuntime.status,
      launchTimestampUtc: initialRuntime.launchTimestampUtc
    };
  });

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    async function initLaunchTimer() {
      const staticConfig = staticConfigOverride || getStaticLaunchConfig();

      let backendConfig = null;
      let clientReceiveEpochMs = Date.now();
      try {
        const res = await fetchLaunchConfig({ signal: abortController?.signal });
        clientReceiveEpochMs = Date.now();
        if (res && res.success) {
          backendConfig = res;
        }
      } catch {
        // Static-only deployments fall back gracefully to persistent build configuration
        backendConfig = null;
      }

      let TemporalImpl = typeof globalThis.Temporal !== 'undefined' ? globalThis.Temporal : null;
      if (!TemporalImpl) {
        try {
          TemporalImpl = await ensureTemporal();
        } catch {
          TemporalImpl = null;
        }
      }

      if (!isMounted) return;

      const runtime = resolveLaunchRuntimeConfig({
        staticConfig,
        backendConfig,
        clientReceiveEpochMs,
        locationPort: locationPortOverride
      });

      setStatusMeta({
        status: runtime.status,
        launchTimestampUtc: runtime.launchTimestampUtc
      });

      if (!runtime.isActive || !runtime.launchTimestampUtc || !TemporalImpl) {
        setElapsed(ZERO_ELAPSED);
        return;
      }

      const updateElapsed = () => {
        if (!isMounted) return;
        const nextElapsed = calculateElapsedTime(runtime.launchTimestampUtc, {
          clockOffsetMs: runtime.clockOffsetMs,
          isActive: true,
          TemporalImpl
        });
        setElapsed(nextElapsed);
      };

      updateElapsed();
      intervalId = setInterval(updateElapsed, 1000);
    }

    initLaunchTimer();

    return () => {
      isMounted = false;
      if (abortController) {
        abortController.abort();
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [staticConfigOverride, fetchLaunchConfig, locationPortOverride]);

  const formattedLaunch = formatLaunchTimestampDisplay(statusMeta.launchTimestampUtc);
  const readableDuration = formatDurationForScreenReader(elapsed);

  const isLive = statusMeta.status === 'live' && elapsed.isLaunched;
  const isDevPreview = statusMeta.status === 'standby-preview';

  const statusBadge = isLive
    ? {
        label: 'LIVE PRODUCTION',
        classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
        dotClass: 'bg-emerald-400 animate-pulse'
      }
    : isDevPreview
      ? {
          label: 'DEV PREVIEW',
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          dotClass: 'bg-amber-400'
        }
      : {
          label: 'PRE-LAUNCH',
          classes: 'bg-slate-500/15 text-slate-300 border-white/15',
          dotClass: 'bg-slate-400'
        };

  const units = [
    { key: 'days', value: formatTwoDigits(elapsed.days), label: 'Days', valueClass: 'text-white', testId: 'launch-days' },
    { key: 'hours', value: formatTwoDigits(elapsed.hours), label: 'Hours', valueClass: 'text-mars-400', testId: 'launch-hours' },
    { key: 'minutes', value: formatTwoDigits(elapsed.minutes), label: 'Minutes', valueClass: 'text-white', testId: 'launch-minutes' },
    { key: 'seconds', value: formatTwoDigits(elapsed.seconds), label: 'Seconds', valueClass: 'text-mars-flame', testId: 'launch-seconds' }
  ];

  return (
    <div
      data-testid="website-launch-timer"
      data-status={statusMeta.status}
      aria-live="off"
      aria-label={`Website launch elapsed time: ${readableDuration}`}
      className={`w-full card-glass rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl ${className}`}
    >
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-mars-400 shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase truncate">
            Official Website Launch Timer
          </span>
        </div>
        <span
          data-testid="launch-timer-status"
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${statusBadge.classes}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} aria-hidden="true"></span>
          <span>{statusBadge.label}</span>
        </span>
      </div>

      {/* 00 Days : 00 Hours : 00 Minutes : 00 Seconds */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 text-center pt-3">
        {units.map((unit, index) => (
          <React.Fragment key={unit.key}>
            <div className="flex-1 min-w-0 bg-space-900/80 rounded-xl p-2 sm:p-2.5 border border-white/5">
              <div
                data-testid={unit.testId}
                className={`font-orbitron font-bold text-lg sm:text-2xl tabular-nums ${unit.valueClass}`}
              >
                {unit.value}
              </div>
              <div className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                {unit.label}
              </div>
            </div>
            {index < units.length - 1 && (
              <span
                aria-hidden="true"
                className="font-orbitron font-bold text-base sm:text-xl text-slate-500 select-none px-0.5"
              >
                :
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-3 text-[11px] font-mono text-slate-400 text-center flex items-center justify-center gap-1.5">
        <Radio className={`w-3 h-3 shrink-0 ${isLive ? 'text-emerald-400' : 'text-amber-400'}`} aria-hidden="true" />
        {isLive && formattedLaunch ? (
          <span>
            Live since {formattedLaunch.istText} ({formattedLaunch.utcText})
          </span>
        ) : isDevPreview ? (
          <span>
            Development preview active • Production timer starts only at official go-live
          </span>
        ) : formattedLaunch ? (
          <span>
            Scheduled Production Go-Live: {formattedLaunch.istText} ({formattedLaunch.utcText})
          </span>
        ) : (
          <span>
            Awaiting official production go-live timestamp configuration
          </span>
        )}
      </div>
    </div>
  );
}
