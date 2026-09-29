import { useEffect, type ReactNode } from 'react'
import { ImgIcon } from './ImgIcon'
import closeV2 from '../assets/ui/v2/close.webp'
import ribbon from '../assets/pages/ribbon_gold.png'
import './sheet.css'

export function Sheet({ open, title, onClose, children, variant }: {
  open: boolean; title?: string; onClose: () => void; children: ReactNode; variant?: 'light'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (variant === 'light') return (
    <div className="sheet-scrim sheet-scrim-light" onClick={onClose}>
      <div className="lsheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <div className="lsheet-title"><img src={ribbon} alt="" draggable={false} /><span>{title}</span></div>}
        <button className="lsheet-close" aria-label="Close" onClick={onClose}><img src={closeV2} alt="" draggable={false} /></button>
        <div className="lsheet-body">{children}</div>
      </div>
    </div>
  )
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" aria-label="Close" onClick={onClose}><ImgIcon name="ib_close" size={34} /></button>
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
