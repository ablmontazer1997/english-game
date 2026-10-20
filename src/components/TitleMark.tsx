import { useId, type ReactNode } from 'react'
import './titlemark.css'

/** Admin 6200/6211 (10-20): the shared title treatment that replaced every big gold ribbon. A bold live title with a thin
 *  gold rule and a small gold star under it, drawn in CSS + inline SVG (crisp at any size, no art). The title text is in
 *  autoFit (.tmark-t): it shrinks to fit its box and wraps (balanced) only if it still does not fit.
 *  tone 'ink': dark violet on light cards / sheets / parchment; 'light': white with a soft shadow on art or dark scenes.
 *  size: 'sm' = an uppercase kicker above a bigger heading, 'md' = sheet title, 'lg' = card title, 'xl' = big intro / result. */
export function TitleMark({ children, tone = 'ink', size = 'md', as: Tag = 'div', className = '' }: {
  children: ReactNode; tone?: 'ink' | 'light'; size?: 'sm' | 'md' | 'lg' | 'xl'
  as?: 'div' | 'h1' | 'h2' | 'h3' | 'p'; className?: string
}) {
  const g = useId().replace(/:/g, '')
  return (
    <Tag className={`tmark tm-${tone} tm-${size}${className ? ` ${className}` : ''}`}>
      <span className="tmark-t">{children}</span>
      <span className="tmark-rule" aria-hidden>
        <i />
        <svg viewBox="0 0 24 24" width="24" height="24">
          <defs>
            <linearGradient id={`tmg${g}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe48a" /><stop offset=".55" stopColor="#f5bf35" /><stop offset="1" stopColor="#e09a17" />
            </linearGradient>
          </defs>
          <path d="M12 2.4l2.8 6 6.5.7-4.85 4.45 1.35 6.4L12 16.75 6.2 19.95l1.35-6.4L2.7 9.1l6.5-.7z"
            fill={`url(#tmg${g})`} stroke="#c88717" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <i />
      </span>
    </Tag>
  )
}
