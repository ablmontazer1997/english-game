import './pages.css'

// test builds open the test wardrobe (no animation picker, admin msg 4260); live keeps /runecast-wardrobe/
const WARDROBE_SRC = import.meta.env.BASE_URL.includes('-test') ? '/runecast-test-wardrobe-ui/' : '/runecast-wardrobe/'

// the 3D wardrobe editor (bingual.app/runecast-wardrobe) full-screen; it saves the look in localStorage,
// which the profile's embedded viewer reads when it mounts again
export function WardrobeScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="screen wd">
      <iframe className="wd-frame" src={WARDROBE_SRC} title="wardrobe" />
      <button className="wd-done" onClick={onClose}>Done</button>
    </div>
  )
}
