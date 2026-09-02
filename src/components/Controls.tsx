import toggleOn from '../assets/ui/controls/toggle_on.webp'
import toggleOff from '../assets/ui/controls/toggle_off.webp'
import checkOn from '../assets/ui/controls/check_on.webp'
import checkOff from '../assets/ui/controls/check_off.webp'
import './controls.css'

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="rc-row" onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="rc-label">{label}</span>
      <img className="rc-toggle" src={on ? toggleOn : toggleOff} alt="" draggable={false} />
    </button>
  )
}

export function Checkbox({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="rc-row" onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="rc-label">{label}</span>
      <img className="rc-check" src={on ? checkOn : checkOff} alt="" draggable={false} />
    </button>
  )
}
