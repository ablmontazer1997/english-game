import { useEffect, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { toCurrencies } from '../services/httpService'
import { sfx } from '../services/audio'
import './pages.css'

// test builds open the test wardrobe (no animation picker, admin msg 4260); live keeps /runecast-wardrobe/
const WARDROBE_SRC = import.meta.env.BASE_URL.includes('-test') ? '/runecast-test-wardrobe-ui/' : '/runecast-wardrobe/'

// the 3D wardrobe editor (bingual.app/runecast-wardrobe) full-screen; it saves the look in localStorage,
// which the profile's embedded viewer reads when it mounts again.
// Admin msg 4269: the wardrobe page draws its own Done button in its bottom bar (it says so with rc-wd-hello and
// sends rc-wd-done); an older page without it keeps this floating button.
export function WardrobeScreen({ onClose }: { onClose: () => void }) {
  const [ownDone, setOwnDone] = useState(false)
  const { setCurrencies } = useGame()
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.data?.type === 'rc-wd-hello' && e.data.done) setOwnDone(true)
      if (e.data?.type === 'rc-wd-done') onClose()
      // Phase B: a buy in place inside the wardrobe (the server already charged it): show the new balance
      if (e.data?.type === 'rc-wd-wallet' && e.data.wallet) setCurrencies(toCurrencies(e.data.wallet))
      if (e.data?.type === 'rc-wd-bought') sfx('reveal')
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [onClose, setCurrencies])
  return (
    <div className="screen wd">
      <iframe className="wd-frame" src={WARDROBE_SRC} title="wardrobe" />
      {!ownDone && <button className="wd-done" onClick={onClose}>Done</button>}
    </div>
  )
}
