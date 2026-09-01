// On-brand inline SVG icons (no emoji-as-icon). Faceted / gem-like where it fits
// the low-poly art direction. `color` uses currentColor so callers set it via CSS.
import type { CSSProperties, ReactNode } from 'react'
type P = { size?: number; className?: string; style?: CSSProperties }
const wrap = (children: ReactNode, { size = 24, className, style }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

export const HeartIcon = (p: P) => wrap(
  <path d="M12 20s-7-4.6-9-9.2C1.6 7.3 3.6 4.5 6.6 4.5c1.9 0 3.2 1.1 3.9 2.3l1.5 2 1.5-2c.7-1.2 2-2.3 3.9-2.3 3 0 5 2.8 3.6 6.3C19 15.4 12 20 12 20z" fill="rgba(255,93,108,.22)" />, p)

export const PotionIcon = (p: P) => wrap(<g fill="rgba(176,98,255,.22)">
  <path d="M10 3h4M10.5 3v3.5L6.7 13a4.6 4.6 0 0 0 4 7h2.6a4.6 4.6 0 0 0 4-7l-3.8-6.5V3" />
  <path d="M7.6 12h8.8" stroke="currentColor" fill="none" /></g>, p)

export const CoinIcon = (p: P) => wrap(<g>
  <circle cx="12" cy="12" r="8" fill="rgba(245,196,81,.22)" />
  <circle cx="12" cy="12" r="4.4" /></g>, p)

export const GemIcon = (p: P) => wrap(<g fill="rgba(154,107,255,.22)">
  <path d="M6 4h12l3 5-9 11L3 9l3-5z" />
  <path d="M3 9h18M9 4l3 16M15 4l-3 16" stroke="currentColor" fill="none" strokeWidth="1.3" /></g>, p)

export const StarIcon = (p: P) => wrap(
  <path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 21l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5z" fill="rgba(245,196,81,.3)" />, p)

export const MapIcon = (p: P) => wrap(<g fill="rgba(87,200,255,.16)">
  <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
  <path d="M9 4v14M15 6v14" stroke="currentColor" fill="none" strokeWidth="1.3" /></g>, p)

export const QuestIcon = (p: P) => wrap(<g fill="rgba(154,107,255,.16)">
  <path d="M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  <path d="M8 8h7M8 12h7M8 16h4" stroke="currentColor" fill="none" strokeWidth="1.3" /></g>, p)

export const LeagueIcon = (p: P) => wrap(<g fill="rgba(245,196,81,.18)">
  <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
  <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 12v4M8 20h8M9 20l1-4h4l1 4" stroke="currentColor" fill="none" strokeWidth="1.4" /></g>, p)

export const ProfileIcon = (p: P) => wrap(<g fill="rgba(197,165,255,.18)">
  <circle cx="12" cy="8" r="4" />
  <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" fill="none" /></g>, p)

export const SettingsIcon = (p: P) => wrap(<g>
  <circle cx="12" cy="12" r="3" />
  <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></g>, p)

export const LockIcon = (p: P) => wrap(<g fill="rgba(154,171,255,.14)">
  <rect x="5" y="10" width="14" height="10" rx="2.4" />
  <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" fill="none" /></g>, p)

export const PlusIcon = (p: P) => wrap(<path d="M12 6v12M6 12h12" strokeWidth="2.2" />, p)

export const CrownIcon = (p: P) => wrap(
  <path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8z" fill="rgba(245,196,81,.25)" />, p)

export const PortalIcon = (p: P) => wrap(<g fill="rgba(154,107,255,.2)">
  <ellipse cx="12" cy="12" rx="6" ry="8.5" />
  <ellipse cx="12" cy="12" rx="2.6" ry="4" stroke="currentColor" fill="none" /></g>, p)

export const FlameIcon = (p: P) => wrap(
  <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.5C9.6 7 12 6 12 3z" fill="rgba(255,140,80,.3)" />, p)

export const BoltIcon = (p: P) => wrap(<path d="M13 2L5 13h6l-1 9 8-11h-6l1-9z" fill="rgba(245,196,81,.25)" />, p)

export const ChestIcon = (p: P) => wrap(<g fill="rgba(154,107,255,.18)">
  <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9H4v-9z" />
  <path d="M4 12h16M11 12v3h2v-3" stroke="currentColor" fill="none" strokeWidth="1.4" /></g>, p)
