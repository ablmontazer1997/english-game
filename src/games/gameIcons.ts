// ES2 (admin 5202, concept 12): every mini-game chip shows that game's own art (not a generic icon)
import orb from '../assets/games/oracle/orb.webp'
import mirror from '../assets/games/curse/cb_mirror_clean.webp'
import rope from '../assets/games/weave/sw_tile_rope.webp'
import golem from '../assets/games/boss2/golem.webp'
import scroll from '../assets/games/whisper/ws_scroll.webp'
import crystal from '../assets/games/echo/ec_crystal.webp'
import wisp from '../assets/games/echo/ec_wisp.webp'
import keeper from '../assets/games/tavern/tt_idle.webp'
import bard from '../assets/games/bard/bt_bard_idle.webp'
import owl from '../assets/games/guild/gl_owl.webp'
import bottle from '../assets/games/potion/pm_bottle1.webp'
import key from '../assets/es2/k/p23/key.webp'
import card from '../assets/games/mb_card_gold.png'
import cback from '../assets/es2/k/p25/card_back.webp'
import gate from '../assets/gate.webp'
import bubble from '../assets/es2/games/bub_violet.webp'
import rune from '../assets/games/runeorder/ro_tile.webp'

export const GAME_ICON: Record<string, string> = {
  'oracle-trial': orb, 'curse-breaker': mirror, 'spell-weaver': rope, 'boss-battle': golem, 'whisper-scroll': scroll,
  echo: wisp, 'crystal-ball': crystal, 'tavern-talk': keeper, 'bards-tale': bard, 'guild-letters': owl, 'potion-mix': bottle,
  'rune-type': key, 'match-blitz': card, 'memory-crystals': cback, 'gap-gate': gate, 'bubble-pop': bubble, 'rune-order': rune,
}
