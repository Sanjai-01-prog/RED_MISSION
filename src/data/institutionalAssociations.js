/**
 * Institutional & Community Associations Configuration
 *
 * Asset inventory (public/images/partners/):
 * - Untouched supplied originals archived in /public/images/partners/originals/
 * - Processed transparent-perimeter web assets served from /images/partners/
 *
 * Confirmed official links:
 * - KPRIET Logo: https://www.kpriet.ac.in/
 * - Rotary Logo: https://www.rotary.org/
 * - Rotaract District 3206: https://rotaract3206.org/
 * - Rotaract College Logo: internal navigation (#rotaract-directory)
 * - NSS Logo: https://www.instagram.com/kpriet.nss/
 */
export const INSTITUTIONAL_ASSOCIATIONS = [
  {
    id: 'kpriet',
    name: 'KPR Institute of Engineering and Technology',
    shortLabel: 'KPRIET',
    subLabel: 'Host Institution',
    logoSrc: '/images/partners/kpriet-association-logo.jpg',
    width: 1024,
    height: 768,
    alt: 'KPR Institute of Engineering and Technology (Autonomous, NAAC A) Learn Beyond official logo',
    type: 'external',
    url: 'https://www.kpriet.ac.in/',
    tone: 'slate-soft'
  },
  {
    id: 'rotary',
    name: 'Rotary International',
    shortLabel: 'Rotary',
    subLabel: 'Sponsor Movement',
    logoSrc: '/images/partners/rotary-association-logo.jpg',
    width: 1024,
    height: 768,
    alt: 'Rotary official logo with Rotary gear emblem',
    type: 'external',
    url: 'https://www.rotary.org/',
    tone: 'slate-soft'
  },
  {
    id: 'rotaract-district-3206',
    name: 'Rotaract District 3206',
    shortLabel: 'Rotaract District 3206',
    subLabel: 'District Organization',
    logoSrc: '/images/partners/rotaract-district-3206-association-logo.jpg',
    width: 1024,
    height: 768,
    alt: 'Rotaract District 3206 Fly Beyond Limits 2026-2027 official emblem',
    type: 'external',
    url: 'https://rotaract3206.org/',
    tone: 'slate-soft'
  },
  {
    id: 'rotaract-college',
    name: 'Rotaract Club of KPRIET',
    shortLabel: 'Rotaract KPRIET',
    subLabel: 'Members Directory',
    logoSrc: '/images/partners/rotaract-kpriet-college-association-logo.jpg',
    width: 1024,
    height: 768,
    alt: 'Rotaract Club of KPR Institute of Engineering and Technology Awaken The Spark logo',
    type: 'internal-directory',
    routeHash: '#rotaract-directory',
    tone: 'slate-soft'
  },
  {
    id: 'nss',
    name: 'National Service Scheme',
    shortLabel: 'NSS',
    subLabel: 'Youth Service',
    logoSrc: '/images/partners/nss-association-logo.jpg',
    width: 1024,
    height: 768,
    alt: 'National Service Scheme (NSS) India official badge',
    type: 'external',
    url: 'https://www.instagram.com/kpriet.nss/',
    tone: 'slate-deep'
  }
];
