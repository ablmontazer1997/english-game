import { useEffect, useState } from 'react'
import './pages.css'

// test builds open the test wardrobe (no animation picker, admin msg 4260); live keeps /runecast-wardrobe/
const WARDROBE_SRC = import.meta.env.BASE_URL.includes('-test') ? '/runecast-test-wardrobe-ui/' : '/runecast-wardrobe/'

// the 3D wardrobe editor (bingual.app/runecast-wardrobe) full-screen; it saves the look in localStorage,
// which the profile's embedded viewer reads when it mounts again.
// Admin msg 4269: the wardrobe page draws its own Done button in its bottom bar (it says so with rc-wd-hello and
// sends rc-wd-done); an older page without it keeps this floating button.
export function WardrobeScreen({ onClose }: { onClose: () => void }) {
  const [ownDone, setOwnDone] = useState(false)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.data?.type === 'rc-wd-hello' && e.data.done) setOwnDone(true)
      if (e.data?.type === 'rc-wd-done') onClose()
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [onClose])
  return (
    <div className="screen wd">
      <iframe className="wd-frame" src={WARDROBE_SRC} title="wardrobe" />
      {!ownDone && <button className="wd-done" onClick={onClose}>Done</button>}
    </div>
  )
}
