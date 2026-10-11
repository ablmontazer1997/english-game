import type { ReactNode } from 'react'
import ribTreasury from '../assets/es2/shop/rib_treasury.webp'
import './eskit.css'

/** ES redesign 10-11: the concept's ribbon header (a violet ribbon with gold stars), the label drawn live on it */
export function RibbonH({ children, i = 0 }: { children: ReactNode; i?: number }) {
  return <div className="shp-ribh esk-enter" style={{ ['--i' as string]: i }}><img src={ribTreasury} alt="" draggable={false} /><span>{children}</span></div>
}
