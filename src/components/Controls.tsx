import toggleOn from '../assets/ui/v2/toggle_on.webp'
import toggleOff from '../assets/ui/v2/toggle_off.webp'
import checkOn from '../assets/ui/v2/check_on.webp'
import checkOff from '../assets/ui/v2/check_off.webp'
import './controls.css'

export function Toggle({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon?: string }) {
  return (
    <button className="rc-row" onClick={() => onChange(!on)} aria-pressed={on}>
      {icon ? <img className="rc-ic" src={icon} alt="" draggable={false} /> : <span className="rc-ic" />}
      <span className="rc-label">{label}</span>
      <img className="rc-toggle" src={on ? toggleOn : toggleOff} alt="" draggable={false} />
    </button>
  )
}

export function Checkbox({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon?: string }) {
  return (
    <button className="rc-row" onClick={() => onChange(!on)} aria-pressed={on}>
      {icon ? <img className="rc-ic" src={icon} alt="" draggable={false} /> : <span className="rc-ic" />}
      <span className="rc-label">{label}</span>
      <img className="rc-check" src={on ? checkOn : checkOff} alt="" draggable={false} />
    </button>
  )
}
