import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { superAdminDonorApi } from '../../../services/api';

function getInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'DR';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function SuperAdminDonorPhoto({
  userId,
  fullName,
  bloodGroup,
  hasPhoto,
  sizeClass = 'w-14 h-14',
  textClass = 'text-base',
  className = ''
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUrl = null;
    const controller = new AbortController();

    setBlobUrl(null);
    setLoadFailed(false);

    if (!userId || !hasPhoto) {
      return () => controller.abort();
    }

    superAdminDonorApi
      .fetchDonorPhotoBlobUrl(userId, { signal: controller.signal })
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        currentUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
        }
      });

    return () => {
      active = false;
      controller.abort();
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [userId, hasPhoto]);

  const showImage = Boolean(hasPhoto && blobUrl && !loadFailed);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-space-900 flex items-center justify-center ${sizeClass} ${className}`}
    >
      {showImage ? (
        <img
          src={blobUrl}
          alt={`${fullName || 'Donor'} registered profile photo`}
          className="w-full h-full object-cover"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="w-full h-full bg-gradient-to-br from-slate-800 via-space-900 to-slate-950 flex flex-col items-center justify-center text-slate-300 select-none"
          aria-label={hasPhoto ? `${fullName || 'Donor'} photo unavailable` : `${fullName || 'Donor'} default avatar`}
        >
          {fullName ? (
            <span className={`font-display font-bold tracking-wider text-slate-200 ${textClass}`}>
              {getInitials(fullName)}
            </span>
          ) : (
            <User className="w-6 h-6 text-slate-400" aria-hidden="true" />
          )}
          {bloodGroup && sizeClass.includes('24') && (
            <span className="mt-0.5 text-[10px] font-mono font-bold text-mars-400">
              {bloodGroup}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
