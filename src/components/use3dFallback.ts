import { useEffect, useState } from 'react'

/** admin 4371: no painted stand-in while a 3D hero loads; the 2D hero shows only if the 3D never comes
 *  (disabled with no3d / bbsprite, or not ready after `ms`). Returns true when the 2D fallback may show. */
export function use3dFallback(ready: boolean, disabled = false, ms = 15000): boolean {
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (ready || disabled) return
    const t = setTimeout(() => setLate(true), ms)
    return () => clearTimeout(t)
  }, [ready, disabled, ms])
  return disabled || (!ready && late)
}
