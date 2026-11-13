import React, { useEffect, useState } from 'react';
import { FALLBACK_DONOR_AVATAR_SVG } from '../../utils/imageFallbacks';
import { getUserToken } from '../../services/api';
import { Droplet } from 'lucide-react';

export default function DonorAvatar({
  src,
  name = 'Donor',
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  bloodGroup,
  className = ''
}) {
  const [imgError, setImgError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(null);

  useEffect(() => {
    setImgError(false);

    if (!src) {
      setResolvedSrc(null);
      return;
    }

    // Inline data URLs, blob URLs, or static non-API assets can be bound directly
    if (src.startsWith('data:') || src.startsWith('blob:') || !src.startsWith('/api/')) {
      setResolvedSrc(src);
      return;
    }

    let objectUrl = null;
    const controller = new AbortController();

    const loadProtectedPhoto = async () => {
      try {
        const token = getUserToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(src, {
          headers,
          credentials: 'include',
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('Failed to load protected donor photo');
        }
        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          throw new Error('Empty donor photo blob');
        }
        objectUrl = URL.createObjectURL(blob);
        if (!controller.signal.aborted) {
          setResolvedSrc(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResolvedSrc(null);
          setImgError(true);
        }
      }
    };

    loadProtectedPhoto();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  const badgeSizes = {
    xs: 'text-[8px] px-1 -bottom-1 -right-1',
    sm: 'text-[9px] px-1 -bottom-1 -right-1',
    md: 'text-[10px] px-1.5 -bottom-1 -right-1',
    lg: 'text-xs px-2 -bottom-1 -right-1',
    xl: 'text-xs px-2.5 bottom-0 right-0'
  };

  const imageSrc = !imgError && resolvedSrc ? resolvedSrc : FALLBACK_DONOR_AVATAR_SVG;

  return (
    <div className={`relative inline-block shrink-0 ${sizeClasses[size] || sizeClasses.md} ${className}`}>
      <div className="w-full h-full rounded-full overflow-hidden border border-mars-500/30 bg-space-900 shadow-md flex items-center justify-center">
        <img
          src={imageSrc}
          alt={`${name}'s visual profile`}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {bloodGroup && (
        <span
          className={`absolute rounded-full font-mono font-bold bg-mars-600 text-white border border-space-950 shadow-sm flex items-center gap-0.5 leading-none py-0.5 ${badgeSizes[size] || badgeSizes.md}`}
          title={`Blood Group: ${bloodGroup}`}
        >
          <Droplet className="w-2 h-2 fill-white shrink-0 hidden sm:inline-block" />
          <span>{bloodGroup}</span>
        </span>
      )}
    </div>
  );
}
