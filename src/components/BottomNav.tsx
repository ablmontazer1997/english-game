import { ImgIcon, type IconName } from './ImgIcon'
import './bottomnav.css'

export type Tab = 'map' | 'quests' | 'league' | 'shop' | 'profile'

// real hand-painted icons; league uses the winged trophy
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'quests', label: 'Quests', icon: 'quests' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
  { id: 'league', label: 'League', icon: 'profile' },
  { id: 'profile', label: 'Profile', icon: 'inventory' },
]

export function BottomNav({ tab, onChange, badge }: { tab: Tab; onChange: (t: Tab) => void; badge?: Partial<Record<Tab, boolean>> }) {
  return (
    <nav className="bnav" aria-label="Main navigation">
      {TABS.map(({ id, label, icon }) => (
        <button key={id} className={`bnav-item${tab === id ? ' active' : ''}`} onClick={() => onChange(id)} aria-current={tab === id}>
          <span className="bnav-ic"><ImgIcon name={icon} size={52} />{badge?.[id] && <i className="dot" />}</span>
          <span className="bnav-lbl">{label}</span>
        </button>
      ))}
    </nav>
  )
}
