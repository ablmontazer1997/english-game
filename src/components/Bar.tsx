import track from '../assets/ui/bars/bar_track.webp'
import fill_gold from '../assets/ui/bars/fill_gold.webp'
import fill_green from '../assets/ui/bars/fill_green.webp'
import fill_red from '../assets/ui/bars/fill_red.webp'
import fill_cyan from '../assets/ui/bars/fill_cyan.webp'
import './bar.css'

const FILL = { gold: fill_gold, green: fill_green, red: fill_red, cyan: fill_cyan }
export type BarTone = keyof typeof FILL

/**
 * Image-based progress bar built from the hand-painted UI kit: an empty "track"
 * plus a colored "fill" revealed left→right by clipping. The fill keeps its
 * painted scale (100cqw of the bar) while the clip width encodes the percentage,
 * so it never stretches — exactly the piece-based approach for a value that
 * grows and shrinks (HP / XP / potion).
 */
export function Bar({ value, tone = 'gold', className, style }: {
  value: number; tone?: BarTone; className?: string; style?: React.CSSProperties
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`rc-bar${className ? ' ' + className : ''}`} style={style}
      role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <img className="rc-bar-track" src={track} alt="" draggable={false} />
      <div className="rc-bar-clip" style={{ width: `calc(${pct}% * 0.98)` }}>
        <img className={`rc-bar-fill tone-${tone}`} src={FILL[tone]} alt="" draggable={false} />
      </div>
    </div>
  )
}
