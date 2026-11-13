import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

export const IST_TIMEZONE = 'Asia/Kolkata';

const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const IST_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
});

const IST_ISO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

/**
 * Formats an instant strictly in India Standard Time (Asia/Kolkata)
 * using en-IN conventions, completely independent of the device timezone.
 */
export function formatIstDateTime(inputDate = new Date()) {
  const parsed = inputDate instanceof Date ? inputDate : new Date(inputDate);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const dateText = IST_DATE_FORMATTER.format(safeDate);

  const timeParts = IST_TIME_FORMATTER.formatToParts(safeDate);
  const getTimePart = (type) => timeParts.find((part) => part.type === type)?.value || '';
  const hour = getTimePart('hour');
  const minute = getTimePart('minute');
  const second = getTimePart('second');
  const dayPeriod = getTimePart('dayPeriod').toUpperCase();
  const clockText = `${hour}:${minute}:${second} ${dayPeriod}`.replace(/\s+/g, ' ').trim();
  const timeText = `${clockText} IST`;

  const isoParts = IST_ISO_FORMATTER.formatToParts(safeDate);
  const getIsoPart = (type) => isoParts.find((part) => part.type === type)?.value || '00';
  const rawIsoHour = getIsoPart('hour');
  const isoHour = rawIsoHour === '24' ? '00' : rawIsoHour;
  const isoDateTime = `${getIsoPart('year')}-${getIsoPart('month')}-${getIsoPart('day')}T${isoHour}:${getIsoPart('minute')}:${getIsoPart('second')}+05:30`;

  return {
    dateText,
    clockText,
    timeText,
    isoDateTime,
    timezone: IST_TIMEZONE,
    timezoneAbbr: 'IST'
  };
}

export default function LiveDateTime({
  variant = 'bar', // 'bar' | 'compact' | 'stacked' | 'pill'
  className = '',
  accent = 'mars', // 'mars' | 'amber'
  showIcon = true
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const { dateText, clockText, timeText, isoDateTime } = formatIstDateTime(now);
  const calendarAccentClass = accent === 'amber' ? 'text-amber-400' : 'text-mars-400';

  const variantClasses = {
    bar: 'inline-flex flex-wrap items-center justify-center sm:justify-end gap-x-2.5 gap-y-1 text-[11px]',
    compact: 'w-full px-3 py-1.5 rounded-xl bg-space-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]',
    stacked: 'inline-flex flex-col items-center sm:items-end justify-center gap-0.5 text-[11px]',
    pill: 'inline-flex flex-col items-center sm:items-end justify-center gap-0.5 text-[11px] px-3.5 py-2 rounded-xl bg-space-900/90 border border-white/10 shadow-sm'
  };

  const isStacked = variant === 'stacked' || variant === 'pill';
  const nowrapClass = variant === 'bar' ? ' whitespace-nowrap' : '';

  return (
    <time
      dateTime={isoDateTime}
      aria-live="off"
      aria-label={`Current IST date and time: ${dateText}, ${timeText}`}
      data-testid="live-datetime"
      className={`no-print font-mono leading-tight ${variantClasses[variant] || variantClasses.bar} ${className}`}
    >
      <span className={`inline-flex items-center gap-1.5 text-slate-300 font-medium${nowrapClass}`}>
        {showIcon && <Calendar className={`w-3 h-3 shrink-0 ${calendarAccentClass}`} aria-hidden="true" />}
        <span>{dateText}</span>
      </span>
      {variant === 'bar' && (
        <span className="hidden sm:inline text-slate-600 select-none" aria-hidden="true">|</span>
      )}
      <span className={`inline-flex items-center gap-1.5 ${isStacked ? 'text-xs ' : ''}text-white font-semibold tabular-nums${nowrapClass}`}>
        {showIcon && <Clock className="w-3 h-3 shrink-0 text-emerald-400" aria-hidden="true" />}
        <span>{clockText}</span>
        <span className="text-emerald-400 font-bold">IST</span>
      </span>
    </time>
  );
}
