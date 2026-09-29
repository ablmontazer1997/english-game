import './pages.css'

// the 3D wardrobe editor (bingual.app/runecast-wardrobe) full-screen; it saves the look in localStorage,
// which the profile's embedded viewer reads when it mounts again
export function WardrobeScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="screen wd">
      <iframe className="wd-frame" src="/runecast-wardrobe/" title="wardrobe" />
      <button className="wd-done" onClick={onClose}>Done</button>
    </div>
  )
}
