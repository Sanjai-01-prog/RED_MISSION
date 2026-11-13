// SVG Data URIs for robust offline and network fallback for Blood Donation Platform

export const FALLBACK_DONOR_AVATAR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c111c"/>
      <stop offset="100%" stop-color="#05070a"/>
    </linearGradient>
    <radialGradient id="dropGlow" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="60%" stop-color="#e11d48"/>
      <stop offset="100%" stop-color="#881337"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="200" cy="200" r="180" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2" fill="none"/>
  <circle cx="200" cy="200" r="160" stroke="#e11d48" stroke-opacity="0.25" stroke-width="1" stroke-dasharray="6,6" fill="none"/>
  
  <!-- Donor Silhouette Profile -->
  <circle cx="200" cy="155" r="55" fill="#1e293b" stroke="#e11d48" stroke-width="3"/>
  <path d="M120,320 C130,235 160,230 200,230 C240,230 270,235 280,320 Z" fill="#1e293b" stroke="#e11d48" stroke-width="3"/>
  
  <!-- Blood Drop Badge -->
  <g transform="translate(175, 125)">
    <path d="M25 0 C25 0 5 22 5 36 C5 47 14 56 25 56 C36 56 45 47 45 36 C45 22 25 0 25 0 Z" fill="url(#dropGlow)" />
    <path d="M22 24 H28 V40 H22 Z M16 29 H34 V35 H16 Z" fill="#ffffff" />
  </g>
  
  <!-- Verified Donor Label -->
  <rect x="110" y="340" width="180" height="28" rx="14" fill="#0b0e17" stroke="#10b981" stroke-width="1.5"/>
  <text x="200" y="358" fill="#10b981" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="2">VERIFIED DONOR</text>
</svg>
`)}`;

export const FALLBACK_CAMP_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <linearGradient id="campBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c111c"/>
      <stop offset="100%" stop-color="#05070a"/>
    </linearGradient>
    <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e11d48" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="500" fill="url(#campBg)"/>
  
  <!-- Facility & Medical Clinic Outline -->
  <circle cx="400" cy="240" r="180" fill="url(#redGlow)"/>
  <rect x="180" y="160" width="440" height="240" rx="20" fill="#0f172a" stroke="#e11d48" stroke-width="2"/>
  
  <!-- Medical Cross on Building -->
  <circle cx="400" cy="240" r="45" fill="#e11d48"/>
  <path d="M392 215 H408 V265 H392 Z M375 232 H425 V248 H375 Z" fill="#ffffff"/>
  
  <!-- Blood Bank Mobile Van Silhouette -->
  <rect x="230" y="290" width="120" height="70" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
  <circle cx="260" cy="360" r="12" fill="#090d14" stroke="#e11d48" stroke-width="2"/>
  <circle cx="320" cy="360" r="12" fill="#090d14" stroke="#e11d48" stroke-width="2"/>
  <path d="M285 315 C285 315 277 325 277 331 C277 336 281 340 285 340 C290 340 293 336 293 331 C293 325 285 315 285 315 Z" fill="#e11d48"/>
  
  <!-- Reclining Donor Station -->
  <rect x="450" y="300" width="120" height="30" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
  <line x1="470" y1="330" x2="470" y2="360" stroke="#64748b" stroke-width="3"/>
  <line x1="550" y1="330" x2="550" y2="360" stroke="#64748b" stroke-width="3"/>
  
  <!-- Technical Labels -->
  <text x="50" y="60" fill="#e11d48" font-family="'Orbitron', sans-serif" font-weight="bold" font-size="16" letter-spacing="3">RED MISSION BLOOD DONATION CAMP</text>
  <text x="50" y="85" fill="#94a3b8" font-family="monospace" font-size="11" letter-spacing="1">FACILITY: VERIFIED MEDICAL MOBILE UNIT</text>
  <text x="750" y="60" fill="#10b981" font-family="monospace" font-size="12" text-anchor="end">CLINICAL HYGIENE: 100% STERILE</text>
</svg>
`)}`;

export const FALLBACK_CERTIFICATE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 550" width="800" height="550">
  <defs>
    <linearGradient id="certBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c111c"/>
      <stop offset="100%" stop-color="#060910"/>
    </linearGradient>
  </defs>
  <rect width="800" height="550" fill="url(#certBg)"/>
  <rect x="25" y="25" width="750" height="500" rx="16" fill="none" stroke="#e11d48" stroke-width="3"/>
  <rect x="35" y="35" width="730" height="480" rx="12" fill="none" stroke="#f43f5e" stroke-width="1" stroke-dasharray="6,4"/>
  
  <text x="400" y="100" fill="#ffffff" font-family="'Orbitron', sans-serif" font-size="24" font-weight="800" text-anchor="middle" letter-spacing="4">RED MISSION</text>
  <text x="400" y="130" fill="#e11d48" font-family="'Orbitron', sans-serif" font-size="14" font-weight="600" text-anchor="middle" letter-spacing="3">CERTIFICATE OF BLOOD DONATION</text>
  
  <line x1="200" y1="150" x2="600" y2="150" stroke="#e11d48" stroke-width="2"/>
  
  <text x="400" y="210" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">This official digital certificate is gratefully presented to</text>
  <text x="400" y="260" fill="#ffffff" font-family="'Orbitron', sans-serif" font-size="26" font-weight="bold" text-anchor="middle" letter-spacing="1">HONORARY LIFESAVER</text>
  <text x="400" y="310" fill="#cbd5e1" font-family="sans-serif" font-size="13" text-anchor="middle">In recognition of noble voluntary blood donation saving valuable human lives.</text>
  
  <!-- Red Seal -->
  <circle cx="400" cy="400" r="45" fill="#e11d48" stroke="#ff4d6d" stroke-width="2"/>
  <path d="M380 395 L395 410 L425 380" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round"/>
  <text x="400" y="465" fill="#f43f5e" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">OFFICIALLY VERIFIED</text>
</svg>
`)}`;
