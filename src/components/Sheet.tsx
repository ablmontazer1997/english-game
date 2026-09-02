import { useEffect, type ReactNode } from 'react'
import { ImgIcon } from './ImgIcon'
import './sheet.css'

export function Sheet({ open, title, onClose, children }: { open: boolean; title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
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
