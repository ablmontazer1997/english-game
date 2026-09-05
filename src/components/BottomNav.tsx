import { SkyIcon, type SkyName } from './SkyIcon'
import './bottomnav.css'

export type Tab = 'map' | 'quests' | 'league' | 'shop' | 'profile'

const TABS: { id: Tab; label: string; icon: SkyName }[] = [
  { id: 'map', label: 'Home', icon: 'nav_home' },
  { id: 'quests', label: 'Quests', icon: 'nav_quests' },
  { id: 'shop', label: 'Shop', icon: 'nav_shop' },
  { id: 'league', label: 'League', icon: 'nav_league' },
  { id: 'profile', label: 'Profile', icon: 'nav_profile' },
]

export function BottomNav({ tab, onChange, badge }: {
  tab: Tab; onChange: (t: Tab) => void; badge?: Partial<Record<Tab, boolean>>
}) {
  return (
    <nav className="bnav" aria-label="Main navigation">
      {TABS.map(({ id, label, icon }) => (
        <button key={id} className={`bnav-item${tab === id ? ' active' : ''}`}
          onClick={() => onChange(id)} aria-current={tab === id}>
          <span className="bnav-ic">
            <SkyIcon name={icon} size={30} />
            {badge?.[id] && <i className="dot" />}
          </span>
          <span className="bnav-lbl">{label}</span>
        </button>
      ))}
    </nav>
  )
}
