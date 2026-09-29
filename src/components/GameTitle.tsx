import ribbon from '../assets/pages/ribbon_title.png'
import './gametitle.css'

/** The shared crest every mini-game shows under the stage bar: gold ribbon with
 *  the game's name and a violet pill with the round counter. */
export function GameTitle({ title, count }: { title: string; count?: string }) {
  return (
    <div className="gt">
      <div className="gt-ribbon"><img src={ribbon} alt="" draggable={false} /><span>{title}</span></div>
      {count && <div className="gt-count">{count}</div>}
    </div>
  )
}
