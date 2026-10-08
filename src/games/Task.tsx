// The task line every mini-game shows: one short imperative ("Pop the bubble that means") with an icon, so a player
// knows at a glance what to do (admin msg 4333). TEST builds pick the look with ?ask=a (header inside the panel)
// or ?ask=b (violet tab on the panel edge); without it the games keep their old prompt until the admin chooses.
import './task.css'

export type TaskIcon = 'tap' | 'build' | 'find' | 'fix' | 'listen' | 'speak' | 'type' | 'order' | 'match'
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('ask') : null
export const ASK: 'a' | 'b' | null = import.meta.env.BASE_URL.includes('-test') && (Q === 'a' || Q === 'b') ? Q : null

const P: Record<TaskIcon, string> = {
  tap: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4.2 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16',
  build: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h16v6H4z',
  find: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM15.5 15.5L20 20',
  fix: 'M4 20L14 10M15 4v3M19 9h-3M18.5 5.5l-2 2M11 4.5l.8 1.6M20 13l-1.6-.8',
  listen: 'M5 9v6h4l5 4V5L9 9zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11',
  speak: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  type: 'M3 7h18v11H3zM6.5 10.5h1M10 10.5h1M13.5 10.5h1M17 10.5h.5M7.5 14.5h9',
  order: 'M4 6h10M4 12h13M4 18h7M18 15l2.5 3L18 21',
  match: 'M7 4a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM17 14a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM9.5 9.5l5 5',
}

export function TaskIc({ icon }: { icon: TaskIcon }) {
  return <svg viewBox="0 0 24 24" aria-hidden><path d={P[icon]} /></svg>
}

/** `first` plays the short "look here" nudge (first round only); `sub` is a one-line how-to shown with it */
export function Task({ icon, text, sub, first, className = '' }: { icon: TaskIcon; text: string; sub?: string; first?: boolean; className?: string }) {
  return (
    <div className={`gtask gtask-${ASK ?? 'a'}${first ? ' first' : ''} ${className}`} role="note">
      <span className="gtask-ic"><TaskIc icon={icon} /></span>
      <span className="gtask-t"><b>{text}</b>{sub && first && <small>{sub}</small>}</span>
    </div>
  )
}
