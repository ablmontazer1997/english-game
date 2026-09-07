import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { MiniGameProps, SrsItem } from './types'
import matchBg from '../assets/matchblitz_bg.webp'
import './matchblitz.css'

// ---- Faithful port of the approved "Match Blitz" (#mb) mini-game from
// pipeline/games.html. Timed pair-matching: LEFT column holds the fronts
// (e.g. English words), RIGHT column the (independently shuffled) backs.
// Drag from a card to its partner to draw a teal connect-line; matching the
// same pair id locks both with a gold glow and bumps the combo, a wrong drop
// shakes them red and breaks the streak. Pairs are chunked into boards; clear
// a board for +6s and the next one loads. Ends when every board is cleared or
// the timer hits zero, reporting { correct, total, maxCombo } exactly once. ----

const NS = 'http://www.w3.org/2000/svg'
const ACCENT = '#f7cf5e'
const ACCENT_GLOW = 'rgba(154,107,255,.45)'
const START_SECONDS = 30
const TIME_CAP = 35
const CLEAR_BONUS = 6
const BOARD_SIZE = 4

function shuffle<T>(a: T[]): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function chunk<T>(a: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size))
  return out
}

type Side = 'L' | 'R'

interface Drag {
  cardEl: HTMLElement
  side: Side
  pid: number
  sx: number
  sy: number
  live: SVGPathElement
  hotEl: HTMLElement | null
  hotKey: string | null
}

export function MatchBlitz({ items, onFinish }: MiniGameProps) {
  // Shuffle all items once, then split into consecutive boards so every pair
  // gets attempted; the right column is shuffled again per board.
  const boards = useMemo<SrsItem[][]>(
    () => chunk(shuffle(items), BOARD_SIZE),
    [items],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const current = boards[roundIdx] ?? []
  const rightOrder = useMemo(
    () => shuffle(current.map((_, i) => i)),
    // re-shuffle whenever the board changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundIdx, boards],
  )

  const [timeLeft, setTimeLeft] = useState(START_SECONDS)
  const [combo, setCombo] = useState(0)
  const [matchedPids, setMatchedPids] = useState<Set<number>>(() => new Set())
  const [selKey, setSelKey] = useState<string | null>(null)
  const [hotKey, setHotKey] = useState<string | null>(null)
  const [wrongKeys, setWrongKeys] = useState<string[]>([])
  const [fb, setFb] = useState<{ msg: string; kind: 'ok' | 'bad'; show: boolean }>({
    msg: '',
    kind: 'ok',
    show: false,
  })

  const boardRef = useRef<HTMLDivElement>(null)
  const linesRef = useRef<SVGSVGElement>(null)
  const comboBoxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const correctRef = useRef(0)
  const comboCountRef = useRef(0)
  const maxComboRef = useRef(0)
  const doneRef = useRef(false)
  const roundIdxRef = useRef(0)
  const boardsRef = useRef<SrsItem[][]>(boards)
  const fbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    roundIdxRef.current = roundIdx
  }, [roundIdx])
  useEffect(() => {
    boardsRef.current = boards
  }, [boards])

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const presented = boardsRef.current
      .slice(0, roundIdxRef.current + 1)
      .reduce((n, b) => n + b.length, 0)
    onFinish({
      correct: correctRef.current,
      total: presented,
      maxCombo: maxComboRef.current,
    })
  }

  // Nothing to match — report immediately.
  useEffect(() => {
    if (items.length === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown.
  useEffect(() => {
    if (items.length === 0) return
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(id)
          finish()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // New board: clear matched set + drawn lines.
  useEffect(() => {
    setMatchedPids(new Set())
    if (linesRef.current) linesRef.current.innerHTML = ''
  }, [roundIdx])

  // Retrigger the combo bump animation on each successful match.
  useEffect(() => {
    const el = comboBoxRef.current
    if (el && combo > 0) {
      el.classList.remove('bump')
      void el.offsetWidth
      el.classList.add('bump')
    }
  }, [combo])

  useEffect(
    () => () => {
      if (fbTimerRef.current) clearTimeout(fbTimerRef.current)
    },
    [],
  )

  function showFeedback(ok: boolean, msg?: string) {
    setFb({ msg: msg || (ok ? 'Nice!' : 'Try again'), kind: ok ? 'ok' : 'bad', show: true })
    if (fbTimerRef.current) clearTimeout(fbTimerRef.current)
    fbTimerRef.current = setTimeout(() => setFb((f) => ({ ...f, show: false })), 950)
  }

  function nodeOf(card: HTMLElement, side: Side) {
    const b = boardRef.current!.getBoundingClientRect()
    const r = card.getBoundingClientRect()
    return {
      x: (side === 'L' ? r.right : r.left) - b.left,
      y: r.top - b.top + r.height / 2,
    }
  }

  function hitCard(e: PointerEvent): HTMLElement | null {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    return (el?.closest('.mb-card') as HTMLElement | null) ?? null
  }

  // Draw the permanent connect-line (glow + line + endpoint dots) for a match.
  function drawPair(L: HTMLElement, R: HTMLElement, anim: boolean) {
    const svg = linesRef.current
    const board = boardRef.current
    if (!svg || !board) return
    const b = board.getBoundingClientRect()
    const a = L.getBoundingClientRect()
    const c = R.getBoundingClientRect()
    const x1 = a.right - b.left
    const y1 = a.top - b.top + a.height / 2
    const x2 = c.left - b.left
    const y2 = c.top - b.top + c.height / 2
    const d = `M${x1},${y1} C${x1 + 24},${y1 - 16} ${x2 - 24},${y2 + 16} ${x2},${y2}`
    const mk = (w: number, cc: string) => {
      const p = document.createElementNS(NS, 'path')
      p.setAttribute('d', d)
      p.setAttribute('stroke', cc)
      p.setAttribute('stroke-width', String(w))
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke-linecap', 'round')
      return p
    }
    const g = mk(12, ACCENT_GLOW)
    const br = mk(4.5, ACCENT)
    svg.appendChild(g)
    svg.appendChild(br)
    ;([[x1, y1], [x2, y2]] as const).forEach(([x, y]) => {
      const cc = document.createElementNS(NS, 'circle')
      cc.setAttribute('cx', String(x))
      cc.setAttribute('cy', String(y))
      cc.setAttribute('r', '7')
      cc.setAttribute('fill', '#fff')
      cc.setAttribute('stroke', ACCENT)
      cc.setAttribute('stroke-width', '3')
      svg.appendChild(cc)
    })
    if (anim) {
      const len = br.getTotalLength()
      ;[g, br].forEach((p) => {
        p.style.strokeDasharray = String(len)
        p.style.strokeDashoffset = String(len)
        p.getBoundingClientRect()
        p.style.transition = 'stroke-dashoffset .35s ease'
        p.style.strokeDashoffset = '0'
      })
    }
  }

  function redraw() {
    const svg = linesRef.current
    const board = boardRef.current
    if (!svg || !board) return
    svg.innerHTML = ''
    matchedPids.forEach((pid) => {
      const L = board.querySelector(`.mb-card-L[data-pid="${pid}"]`) as HTMLElement | null
      const R = board.querySelector(`.mb-card-R[data-pid="${pid}"]`) as HTMLElement | null
      if (L && R) drawPair(L, R, false)
    })
  }

  // Redraw matched lines on resize so they track the cards.
  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedPids])

  function boardCleared() {
    setTimeLeft((t) => Math.min(TIME_CAP, t + CLEAR_BONUS))
    showFeedback(true, `Cleared! +${CLEAR_BONUS}s`)
    window.setTimeout(() => {
      if (doneRef.current) return
      if (roundIdxRef.current + 1 < boardsRef.current.length) {
        setRoundIdx((r) => r + 1)
      } else {
        finish()
      }
    }, 750)
  }

  function onMove(e: PointerEvent) {
    const d = dragRef.current
    if (!d) return
    e.preventDefault()
    const b = boardRef.current!.getBoundingClientRect()
    const x = e.clientX - b.left
    const y = e.clientY - b.top
    const mx = (d.sx + x) / 2
    d.live.setAttribute('d', `M${d.sx},${d.sy} C${mx},${d.sy} ${mx},${y} ${x},${y}`)
    const t = hitCard(e)
    const valid =
      !!t && t !== d.cardEl && !t.classList.contains('matched') && t.dataset.side !== d.side
    const newHot = valid ? `${t!.dataset.side}${t!.dataset.pid}` : null
    if (newHot !== d.hotKey) {
      d.hotKey = newHot
      d.hotEl = valid ? t : null
      setHotKey(newHot)
    }
  }

  function onUp(e: PointerEvent) {
    const d = dragRef.current
    dragRef.current = null
    window.removeEventListener('pointermove', onMove)
    if (!d) return
    setSelKey(null)
    setHotKey(null)
    d.live.remove()

    const tgt = hitCard(e)
    if (
      !tgt ||
      tgt === d.cardEl ||
      tgt.classList.contains('matched') ||
      tgt.dataset.side === d.side
    )
      return

    if (tgt.dataset.pid === String(d.pid)) {
      // Correct pair.
      const pid = d.pid
      const L = d.side === 'L' ? d.cardEl : tgt
      const R = d.side === 'L' ? tgt : d.cardEl
      drawPair(L, R, true)
      correctRef.current += 1
      comboCountRef.current += 1
      if (comboCountRef.current > maxComboRef.current) maxComboRef.current = comboCountRef.current
      setCombo(comboCountRef.current)
      showFeedback(true)
      const next = new Set(matchedPids)
      next.add(pid)
      setMatchedPids(next)
      if (next.size === current.length) boardCleared()
    } else {
      // Wrong pair: shake red, break the streak.
      const k1 = `${d.side}${d.pid}`
      const k2 = `${tgt.dataset.side}${tgt.dataset.pid}`
      setWrongKeys([k1, k2])
      window.setTimeout(() => setWrongKeys([]), 430)
      comboCountRef.current = 0
      setCombo(0)
      showFeedback(false)
    }
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>, side: Side, pid: number) {
    if (doneRef.current) return
    if (matchedPids.has(pid)) return
    e.preventDefault()
    const cardEl = e.currentTarget
    const n = nodeOf(cardEl, side)
    setSelKey(`${side}${pid}`)
    const live = document.createElementNS(NS, 'path')
    live.setAttribute('stroke', ACCENT)
    live.setAttribute('stroke-width', '6')
    live.setAttribute('fill', 'none')
    live.setAttribute('stroke-linecap', 'round')
    live.setAttribute('opacity', '.95')
    live.style.filter = `drop-shadow(0 0 5px ${ACCENT_GLOW})`
    linesRef.current?.appendChild(live)
    dragRef.current = { cardEl, side, pid, sx: n.x, sy: n.y, live, hotEl: null, hotKey: null }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('pointercancel', onUp, { once: true })
  }

  function cardCls(side: Side, pid: number): string {
    const key = `${side}${pid}`
    let c = `mb-card mb-card-${side}`
    if (matchedPids.has(pid)) c += ' matched'
    if (selKey === key) c += ' sel'
    if (hotKey === key) c += ' hot'
    if (wrongKeys.includes(key)) c += ' wrong'
    return c
  }

  // Decorative combo rays (built once).
  const rays = useMemo<ReactElement[]>(() => {
    const arr: ReactElement[] = []
    for (let i = 0; i < 16; i++) {
      const a = (i * 22.5 * Math.PI) / 180
      const cx = 115
      const cy = 52
      const r1 = 44 + (i % 2) * 8
      const r2 = 78 + (i % 3) * 14
      arr.push(
        <line
          key={i}
          x1={cx + Math.cos(a) * r1}
          y1={cy + Math.sin(a) * r1 * 0.62}
          x2={cx + Math.cos(a) * r2}
          y2={cy + Math.sin(a) * r2 * 0.62}
          stroke="#FFC848"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.55}
        />,
      )
    }
    return arr
  }, [])

  if (items.length === 0) {
    return <div className="mb-wait">Nothing to match</div>
  }

  const fillPct = Math.min(100, (Math.max(0, timeLeft) / START_SECONDS) * 100)
  const timeText = `0:${String(Math.max(0, timeLeft)).padStart(2, '0')}`
  const comboText = `x${Math.max(1, combo)}`

  return (
    <div className="matchblitz" style={{ backgroundImage: `url(${matchBg})` }}>
      <div className="mb-scrim" />
      <div className="mb-app">
        <div className="mb-top">
          <div className="mb-back">&#8592;</div>
          <div className="mb-title">Match Blitz</div>
        </div>

        <div className="mb-combo" ref={comboBoxRef}>
          <div className="mb-burst" />
          <svg className="mb-rays" viewBox="0 0 230 104">
            {rays}
          </svg>
          <div className="mb-combo-txt">
            <span className="mb-c1">COMBO</span>
            <span className="mb-c2">{comboText}</span>
          </div>
        </div>

        <div className="mb-tbar">
          <div className="mb-fill" style={{ width: `${fillPct}%` }} />
          <div className="mb-tt">{timeText}</div>
        </div>

        <div className="mb-board" ref={boardRef}>
          <svg className="mb-lines" ref={linesRef} />
          {current.map((pair, slot) => {
            const lpid = slot
            const rpid = rightOrder[slot]
            const rpair = current[rpid]
            return (
              <div className="mb-row" key={slot}>
                <div
                  className={cardCls('L', lpid)}
                  data-side="L"
                  data-pid={lpid}
                  onPointerDown={(e) => onDown(e, 'L', lpid)}
                >
                  {pair.front}
                </div>
                <div
                  className={cardCls('R', rpid)}
                  data-side="R"
                  data-pid={rpid}
                  onPointerDown={(e) => onDown(e, 'R', rpid)}
                >
                  {rpair?.back}
                </div>
              </div>
            )
          })}
        </div>

        <div className={`mb-fb${fb.show ? ' show' : ''} ${fb.kind}`}>{fb.msg}</div>
      </div>
    </div>
  )
}
