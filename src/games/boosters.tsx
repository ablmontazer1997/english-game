import { createContext, useContext, useEffect, useRef } from 'react'

/** A game's hint: apply one hint and return true, or return false when no hint
 *  fits right now (then no coins are spent). */
export type HintFn = () => boolean

export const HINT_COST = 20

export const HintCtx = createContext<((fn: HintFn | null) => void) | null>(null)

/** Mini-games call this to offer a hint through the shared booster tray. */
export function useHint(fn: HintFn) {
  const register = useContext(HintCtx)
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    if (!register) return
    register(() => latest.current())
    return () => register(null)
  }, [register])
}
