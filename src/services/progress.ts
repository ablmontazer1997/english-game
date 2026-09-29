// Pure game-progress rules: what the player has done (stats), the daily/weekly
// quests built from it, achievements, chests and the weekly league. No I/O, no
// browser APIs: the mock service keeps the state, a real backend can reuse the
// same rules (and the same numbers) server-side.
import type { MiniGameId, Reward, Quest, ChestKind, LeagueTier, LeagueEntry, Achievement, AchievementCat } from '../types/game'

// ---------- time buckets ----------
const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
/** weeks start on Monday 00:00 local time */
export function weekStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
export const weekKey = (t = Date.now()) => dayKey(weekStart(t))
export const weekEnd = (t = Date.now()) => weekStart(t) + 7 * 864e5
export const dayEnd = (t = Date.now()) => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime() }
const yesterday = (k: string) => { const [y, m, d] = k.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1).getTime()) }

// ---------- counters ----------
/** what one period (a day, a week, or all time) has seen */
export interface Tally {
  played: number; won: number; stars3: number; stars: number; correct: number; answered: number
  xp: number; coins: number; gems: number; hints: number; elixirs: number; bosses: number
  perfectBoss: number; chests: number; quests: number; buys: number; games: MiniGameId[]
}
export const emptyTally = (): Tally => ({ played: 0, won: 0, stars3: 0, stars: 0, correct: 0, answered: 0, xp: 0, coins: 0, gems: 0,
  hints: 0, elixirs: 0, bosses: 0, perfectBoss: 0, chests: 0, quests: 0, buys: 0, games: [] })

export interface Progress {
  all: Tally
  day: { key: string } & Tally
  week: { key: string; dailyDone: number } & Tally
  /** distinct mini-games ever played -> times */
  gamesAll: Partial<Record<MiniGameId, number>>
  streak: number; streakBest: number; lastActive: string | null; freezes: number
  xpBoostUntil: number
  chests: Record<ChestKind, number>
  claimedQuests: string[]          // `${period}:${periodKey}:${questId}`
  claimedAch: string[]
  league: { week: string; tier: LeagueTier; promotions: number; top3: number; firsts: number; last?: { tier: LeagueTier; rank: number; moved: -1 | 0 | 1; reward: Reward; week: string } }
}

export function newProgress(tier: LeagueTier): Progress {
  return {
    all: emptyTally(), day: { key: dayKey(), ...emptyTally() }, week: { key: weekKey(), dailyDone: 0, ...emptyTally() },
    gamesAll: {}, streak: 0, streakBest: 0, lastActive: null, freezes: 0, xpBoostUntil: 0,
    chests: { wood: 0, silver: 0, epic: 0 }, claimedQuests: [], claimedAch: [],
    league: { week: weekKey(), tier, promotions: 0, top3: 0, firsts: 0 },
  }
}

/** roll the day/week buckets forward; returns the league result if a week ended */
export function rollPeriods(p: Progress, now = Date.now()) {
  const dk = dayKey(now), wk = weekKey(now)
  if (p.day.key !== dk) p.day = { key: dk, ...emptyTally() }
  let ended: Progress['league']['last'] | undefined
  if (p.league.week !== wk) { ended = settleLeague(p, now); p.league.week = wk }
  if (p.week.key !== wk) p.week = { key: wk, dailyDone: 0, ...emptyTally() }
  return ended
}

function bump(t: Tally, f: (t: Tally) => void) { f(t) }
function addAll(p: Progress, f: (t: Tally) => void) { bump(p.all, f); bump(p.day, f); bump(p.week, f) }

/** a finished stage (won or lost) */
export function recordStage(p: Progress, r: { miniGame: MiniGameId; stars: number; correct: number; total: number; xp: number; coins: number; boss: boolean }, now = Date.now()) {
  rollPeriods(p, now)
  addAll(p, (t) => {
    t.played++; t.correct += r.correct; t.answered += r.total; t.xp += r.xp; t.coins += r.coins
    if (!t.games.includes(r.miniGame)) t.games.push(r.miniGame)
    if (r.stars > 0) { t.won++; t.stars += r.stars }
    if (r.stars === 3) t.stars3++
    if (r.boss && r.stars > 0) t.bosses++
    if (r.boss && r.stars === 3) t.perfectBoss++
  })
  p.gamesAll[r.miniGame] = (p.gamesAll[r.miniGame] ?? 0) + 1
  // the streak counts days with at least one won stage; a Streak Freeze covers one missed day
  if (r.stars > 0) {
    const dk = dayKey(now)
    if (p.lastActive !== dk) {
      if (p.lastActive === yesterday(dk)) p.streak++
      else if (p.lastActive && p.freezes > 0 && p.lastActive === yesterday(yesterday(dk))) { p.freezes--; p.streak++ }
      else p.streak = 1
      p.lastActive = dk
      p.streakBest = Math.max(p.streakBest, p.streak)
    }
  }
}
/** the streak shown today: broken if the last active day is older than yesterday (and no freeze) */
export function liveStreak(p: Progress, now = Date.now()) {
  const dk = dayKey(now)
  if (!p.lastActive) return 0
  if (p.lastActive === dk || p.lastActive === yesterday(dk)) return p.streak
  if (p.freezes > 0 && p.lastActive === yesterday(yesterday(dk))) return p.streak
  return 0
}
export const recordHint = (p: Progress) => { rollPeriods(p); addAll(p, (t) => t.hints++) }
export const recordElixir = (p: Progress) => { rollPeriods(p); addAll(p, (t) => t.elixirs++) }
export const recordEarn = (p: Progress, coins: number, gems: number) => { rollPeriods(p); addAll(p, (t) => { t.coins += coins; t.gems += gems }) }
export const recordBuy = (p: Progress) => { rollPeriods(p); addAll(p, (t) => t.buys++) }

// ---------- seeded randomness (same quests / bots for everyone on the same day) ----------
export function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6 }
}

// ---------- quests ----------
type QT = { id: string; title: (n: number) => string; n: number[]; get: (t: Tally) => number; reward: Reward }
const DAILY: QT[] = [
  { id: 'win', title: (n) => `Win ${n} stages`, n: [2, 3], get: (t) => t.won, reward: { coins: 120 } },
  { id: 'three', title: (n) => n === 1 ? 'Earn 3 stars in a stage' : `Earn 3 stars in ${n} stages`, n: [1, 2], get: (t) => t.stars3, reward: { coins: 150 } },
  { id: 'correct', title: (n) => `Answer ${n} questions correctly`, n: [20, 30], get: (t) => t.correct, reward: { potion: 1 } },
  { id: 'xp', title: (n) => `Earn ${n} XP`, n: [150, 250], get: (t) => t.xp, reward: { coins: 100 } },
  { id: 'variety', title: (n) => `Play ${n} different games`, n: [2, 3], get: (t) => t.games.length, reward: { coins: 110 } },
  { id: 'stars', title: (n) => `Collect ${n} stars`, n: [5, 8], get: (t) => t.stars, reward: { coins: 130 } },
]
const WEEKLY: QT[] = [
  { id: 'wwin', title: (n) => `Win ${n} stages this week`, n: [12, 15], get: (t) => t.won, reward: { gems: 15 } },
  { id: 'wthree', title: (n) => `Earn 3 stars in ${n} stages`, n: [6, 8], get: (t) => t.stars3, reward: { gems: 15 } },
  { id: 'wcorrect', title: (n) => `Answer ${n} questions correctly`, n: [120, 160], get: (t) => t.correct, reward: { chest: 'silver' } },
  { id: 'wboss', title: () => 'Defeat a world boss', n: [1], get: (t) => t.bosses, reward: { gems: 20 } },
  { id: 'wxp', title: (n) => `Earn ${n} XP`, n: [1200, 1600], get: (t) => t.xp, reward: { gems: 10 } },
]
const pickN = <T,>(arr: T[], k: number, rnd: () => number) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, k) }

export function buildQuests(p: Progress): Quest[] {
  rollPeriods(p)
  const out: Quest[] = []
  const mk = (period: 'daily' | 'weekly', key: string, t: Tally, pool: QT[], k: number) => {
    const rnd = seeded(period + key)
    for (const q of pickN(pool, k, rnd)) {
      const n = q.n[Math.floor(rnd() * q.n.length)]
      const id = `${period}:${key}:${q.id}`
      out.push({ id, title: q.title(n), progress: Math.min(n, q.get(t)), target: n, reward: q.reward, period, done: p.claimedQuests.includes(id) })
    }
  }
  mk('daily', p.day.key, p.day, DAILY, 3)
  // finishing all three dailies opens the daily chest
  const dailies = out.filter((q) => q.period === 'daily')
  const doneN = dailies.filter((q) => q.done).length
  const bonus = `daily:${p.day.key}:all`
  out.push({ id: bonus, title: 'Complete all daily quests', progress: doneN, target: dailies.length, reward: { chest: 'wood', gems: 2 }, period: 'daily', done: p.claimedQuests.includes(bonus), bonus: true })
  mk('weekly', p.week.key, p.week, WEEKLY, 3)
  const wb = `weekly:${p.week.key}:days`
  out.push({ id: wb, title: 'Finish your dailies on 5 days', progress: Math.min(5, p.week.dailyDone), target: 5, reward: { chest: 'epic' }, period: 'weekly', done: p.claimedQuests.includes(wb), bonus: true })
  return out
}

// ---------- chests ----------
export const CHEST_LABEL: Record<ChestKind, string> = { wood: 'Wooden Chest', silver: 'Silver Chest', epic: 'Epic Chest' }
export function rollChest(kind: ChestKind, rnd = Math.random): Reward {
  const r = (a: number, b: number) => Math.round(a + rnd() * (b - a))
  if (kind === 'wood') return { coins: r(80, 150), ...(rnd() < 0.35 ? { potion: 1 } : {}) }
  if (kind === 'silver') return { coins: r(200, 350), gems: r(3, 8), ...(rnd() < 0.5 ? { potion: 1 } : {}) }
  return { coins: r(500, 800), gems: r(15, 30), potion: r(1, 2) }
}

// ---------- league ----------
export const TIERS: LeagueTier[] = ['bronze', 'silver', 'gold', 'ruby', 'astral', 'legend']
export const LEAGUE_SIZE = 15, PROMOTE = 3, DEMOTE = 3
export function leagueReward(rank: number): Reward {
  return rank === 1 ? { gems: 30, chest: 'epic' } : rank === 2 ? { gems: 20, chest: 'silver' } : rank === 3 ? { gems: 15, chest: 'silver' }
    : rank <= 10 ? { gems: 5 } : {}
}
const BOT_NAMES = ['Aria', 'Sam', 'Kai', 'Mia', 'Leo', 'Nia', 'Max', 'Zoe', 'Ivy', 'Finn', 'Luna', 'Omar', 'Rin', 'Theo', 'Ada', 'Juno', 'Eli', 'Sage', 'Nova', 'Remy']
/** fourteen rivals whose weekly XP grows through the week at their own pace (tier-scaled) */
export function leagueTable(p: Progress, meName: string, now = Date.now()): LeagueEntry[] {
  const wk = weekKey(now), rnd = seeded('league' + wk + p.league.tier)
  const frac = Math.min(1, (now - weekStart(now)) / (7 * 864e5))
  const scale = 0.6 + TIERS.indexOf(p.league.tier) * 0.3        // Bronze rivals are gentle, Legend ones grind
  const names = pickN(BOT_NAMES, LEAGUE_SIZE - 1, rnd)
  const bots = names.map((name, i) => {
    const pace = (120 + rnd() * 330) * scale                    // XP per day at the end of the week
    const burst = 0.7 + 0.6 * rnd()                             // some start fast, some finish strong
    const lp = Math.round(pace * 7 * Math.pow(frac, burst))
    return { playerId: `bot${i}`, name, lp, isMe: false }
  })
  const me = { playerId: 'me', name: meName, lp: p.week.xp, isMe: true }
  return [...bots, me].sort((a, b) => b.lp - a.lp || (a.isMe ? -1 : 1))
}
/** week ended: move up/down a tier, pay the rank reward (stored for the result banner) */
function settleLeague(p: Progress, now: number): Progress['league']['last'] {
  const endT = weekStart(now) - 1                               // the last moment of the finished week
  const snap: Progress = { ...p, league: { ...p.league } }
  const table = leagueTable(snap, 'me', endT)
  const rank = table.findIndex((e) => e.isMe) + 1
  const ti = TIERS.indexOf(p.league.tier)
  const moved: -1 | 0 | 1 = p.week.xp > 0 && rank <= PROMOTE && ti < TIERS.length - 1 ? 1 : rank > LEAGUE_SIZE - DEMOTE && ti > 0 ? -1 : 0
  const reward = p.week.xp > 0 ? leagueReward(rank) : {}
  const last = { tier: p.league.tier, rank, moved, reward, week: p.league.week }
  p.league.tier = TIERS[ti + moved]
  if (moved === 1) p.league.promotions++
  if (rank <= 3 && p.week.xp > 0) p.league.top3++
  if (rank === 1 && p.week.xp > 0) p.league.firsts++
  p.league.last = last
  return last
}

// ---------- achievements ----------
type AD = { id: string; cat: AchievementCat; title: string; desc: (n: number) => string; steps: number[]; get: (p: Progress, x: AchCtx) => number; gems: number[] }
export interface AchCtx { worldsDone: number; stagesDone: number; starsTotal: number; level: number }
const G = [3, 8, 20, 40]
const ACH: AD[] = [
  { id: 'journey', cat: 'journey', title: 'Pathfinder', desc: (n) => `Clear ${n} stages on the map`, steps: [5, 25, 60, 120], get: (_, x) => x.stagesDone, gems: G },
  { id: 'worlds', cat: 'journey', title: 'Realm Walker', desc: (n) => `Finish ${n} world${n > 1 ? 's' : ''}`, steps: [1, 3, 6, 11], get: (_, x) => x.worldsDone, gems: [10, 20, 40, 80] },
  { id: 'level', cat: 'journey', title: 'Rising Mage', desc: (n) => `Reach level ${n}`, steps: [15, 25, 40, 60], get: (_, x) => x.level, gems: G },
  { id: 'stars', cat: 'stars', title: 'Stargazer', desc: (n) => `Collect ${n} stars`, steps: [15, 60, 150, 300], get: (_, x) => x.starsTotal, gems: G },
  { id: 'perfect', cat: 'stars', title: 'Flawless', desc: (n) => `Earn 3 stars in ${n} stages`, steps: [3, 15, 40, 90], get: (p) => p.all.stars3, gems: G },
  { id: 'correct', cat: 'scholar', title: 'Scholar', desc: (n) => `Answer ${n} questions correctly`, steps: [50, 250, 1000, 3000], get: (p) => p.all.correct, gems: G },
  { id: 'accuracy', cat: 'scholar', title: 'Sharp Mind', desc: (n) => `Keep ${n}% accuracy over 100+ answers`, steps: [75, 85, 92, 97],
    get: (p) => p.all.answered >= 100 ? Math.floor((p.all.correct / p.all.answered) * 100) : 0, gems: G },
  { id: 'played', cat: 'scholar', title: 'Dedicated', desc: (n) => `Play ${n} stages`, steps: [10, 50, 150, 400], get: (p) => p.all.played, gems: G },
  { id: 'streak', cat: 'streak', title: 'On Fire', desc: (n) => `Reach a ${n}-day streak`, steps: [3, 7, 30, 100], get: (p) => p.streakBest, gems: [5, 10, 30, 80] },
  { id: 'boss', cat: 'boss', title: 'Dragon Tamer', desc: (n) => `Defeat ${n} world boss${n > 1 ? 'es' : ''}`, steps: [1, 3, 6, 11], get: (p) => p.all.bosses, gems: [5, 12, 25, 50] },
  { id: 'bossperfect', cat: 'boss', title: 'Untouchable', desc: (n) => `Beat ${n} boss${n > 1 ? 'es' : ''} with 3 stars`, steps: [1, 3, 6], get: (p) => p.all.perfectBoss, gems: [8, 20, 45] },
  { id: 'chests', cat: 'treasure', title: 'Treasure Hunter', desc: (n) => `Open ${n} chests`, steps: [3, 15, 40, 100], get: (p) => p.all.chests, gems: G },
  { id: 'coins', cat: 'wealth', title: 'Gold Hoarder', desc: (n) => `Earn ${n.toLocaleString('en-US')} coins`, steps: [1000, 5000, 20000, 60000], get: (p) => p.all.coins, gems: G },
  { id: 'gems', cat: 'gems', title: 'Gem Collector', desc: (n) => `Earn ${n} gems`, steps: [50, 200, 600, 1500], get: (p) => p.all.gems, gems: [3, 8, 15, 30] },
  { id: 'league', cat: 'league', title: 'Contender', desc: (n) => `Get promoted ${n} time${n > 1 ? 's' : ''}`, steps: [1, 3, 5], get: (p) => p.league.promotions, gems: [10, 25, 50] },
  { id: 'podium', cat: 'league', title: 'On the Podium', desc: (n) => `Finish in the top 3 of your league ${n}×`, steps: [1, 5, 15], get: (p) => p.league.top3, gems: [10, 20, 40] },
  { id: 'champion', cat: 'league', title: 'Champion', desc: (n) => `Win your league ${n}×`, steps: [1, 3, 10], get: (p) => p.league.firsts, gems: [15, 30, 60] },
  { id: 'quests', cat: 'quests', title: 'Quest Keeper', desc: (n) => `Claim ${n} quests`, steps: [5, 30, 100, 300], get: (p) => p.all.quests, gems: G },
  { id: 'elixir', cat: 'elixir', title: 'Second Wind', desc: (n) => `Save ${n} stage${n > 1 ? 's' : ''} with an elixir`, steps: [1, 10, 30], get: (p) => p.all.elixirs, gems: [3, 8, 15] },
  { id: 'hints', cat: 'elixir', title: 'Wise Owl', desc: (n) => `Use ${n} hints`, steps: [5, 30, 100], get: (p) => p.all.hints, gems: [3, 8, 15] },
  { id: 'explorer', cat: 'explorer', title: 'Explorer', desc: (n) => `Play ${n} different mini-games`, steps: [5, 10, 17], get: (p) => Object.keys(p.gamesAll).length, gems: [5, 15, 30] },
  { id: 'shopper', cat: 'wealth', title: 'Good Deal', desc: (n) => `Buy ${n} item${n > 1 ? 's' : ''} in the shop`, steps: [1, 10, 40], get: (p) => p.all.buys, gems: [3, 8, 15] },
]
export const ACH_CATS: { id: AchievementCat; label: string }[] = [
  { id: 'journey', label: 'Journey' }, { id: 'stars', label: 'Stars' }, { id: 'scholar', label: 'Scholar' }, { id: 'streak', label: 'Streak' },
  { id: 'boss', label: 'Bosses' }, { id: 'treasure', label: 'Treasure' }, { id: 'wealth', label: 'Wealth' }, { id: 'gems', label: 'Gems' },
  { id: 'league', label: 'League' }, { id: 'quests', label: 'Quests' }, { id: 'elixir', label: 'Craft' }, { id: 'explorer', label: 'Explorer' },
]
/** every step of every achievement family is its own card (tier 1..4 = bronze, silver, gold, astral) */
export function buildAchievements(p: Progress, x: AchCtx): Achievement[] {
  const out: Achievement[] = []
  for (const a of ACH) {
    const v = a.get(p, x)
    a.steps.forEach((n, i) => {
      const id = `${a.id}.${i + 1}`
      out.push({ id, cat: a.cat, title: `${a.title}${a.steps.length > 1 ? ' ' + ['I', 'II', 'III', 'IV'][i] : ''}`, desc: a.desc(n), tier: i + 1,
        progress: Math.min(v, n), target: n, reward: { gems: a.gems[i] }, claimed: p.claimedAch.includes(id) })
    })
  }
  return out
}

export const XP_BOOST_MS = 15 * 60 * 1000
