import { SkyIcon, type SkyName } from './SkyIcon'
import './bottomnav.css'

export type Tab = 'map' | 'quests' | 'league' | 'shop' | 'profile'

const TABS: { id: Tab; label: string; icon: SkyName }[] = [
  { id: 'map', label: 'Home', icon: 'nav2_home' },
  { id: 'quests', label: 'Quests', icon: 'nav2_quests' },
  { id: 'shop', label: 'Shop', icon: 'nav2_shop' },
  { id: 'league', label: 'League', icon: 'nav2_league' },
  { id: 'profile', label: 'Profile', icon: 'nav2_profile' },
]

export function BottomNav({ tab, onChange, badge }: {
  tab: Tab; onChange: (t: Tab) => void; badge?: Partial<Record<Tab, boolean>>
}) {
  const active = Math.max(0, TABS.findIndex((t) => t.id === tab))
  return (
    <nav className="bnav" aria-label="Main navigation">
      {/* the lit cradle slides under whichever tab is active */}
      <span className="bnav-cradle" aria-hidden
        style={{ left: `calc(6px + (100% - 12px) * ${(active + 0.5) / TABS.length})` }} />
      {TABS.map(({ id, label, icon }) => (
        <button key={id} className={`bnav-item${tab === id ? ' active' : ''}`}
          onClick={() => onChange(id)} aria-current={tab === id}>
          <span className="bnav-ic">
            <SkyIcon name={icon} size={46} />
            {badge?.[id] && <i className="dot" />}
          </span>
          <span className="bnav-lbl">{label}</span>
        </button>
      ))}
    </nav>
  )
}
