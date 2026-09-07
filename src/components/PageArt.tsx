import type { CSSProperties, ReactNode } from 'react'

// Art for the four secondary pages (pipeline/sky, sheets a_*). Every asset is
// text-free; labels are drawn over it in the app. Panels keep their painted
// aspect ratio and only ever scale uniformly.
import qi_star from '../assets/pages/qi_star.png'
import qi_potion from '../assets/pages/qi_potion.png'
import qi_crystal from '../assets/pages/qi_crystal.png'
import qi_chest from '../assets/pages/qi_chest.png'
import qi_flame from '../assets/pages/qi_flame.png'
import ui_card_wide from '../assets/pages/ui_card_wide.png'
import btn_gold from '../assets/pages/btn_gold.png'
import chip_violet from '../assets/pages/chip_violet.png'
import switch_seg from '../assets/pages/switch_seg.png'
import gem_s from '../assets/pages/gem_s.png'
import gem_m from '../assets/pages/gem_m.png'
import gem_l from '../assets/pages/gem_l.png'
import gem_xl from '../assets/pages/gem_xl.png'
import chest_wood from '../assets/pages/chest_wood.png'
import chest_silver from '../assets/pages/chest_silver.png'
import chest_epic from '../assets/pages/chest_epic.png'
import chest_open from '../assets/pages/chest_open.png'
import panel_banner from '../assets/pages/panel_banner.png'
import card_square from '../assets/pages/card_square.png'
import btn_green from '../assets/pages/btn_green.png'
import ribbon_gold from '../assets/pages/ribbon_gold.png'
import tier_1 from '../assets/pages/tier_1.png'
import tier_2 from '../assets/pages/tier_2.png'
import tier_3 from '../assets/pages/tier_3.png'
import tier_4 from '../assets/pages/tier_4.png'
import tier_5 from '../assets/pages/tier_5.png'
import rank_gold from '../assets/pages/rank_gold.png'
import rank_silver from '../assets/pages/rank_silver.png'
import rank_bronze from '../assets/pages/rank_bronze.png'
import trophy_big from '../assets/pages/trophy_big.png'
import podium from '../assets/pages/podium.png'
import card_stat from '../assets/pages/card_stat.png'
import btn_edit from '../assets/pages/btn_edit.png'
import panel_wide from '../assets/pages/panel_wide.png'
import badge_1 from '../assets/pages/badge_1.png'
import badge_2 from '../assets/pages/badge_2.png'
import badge_3 from '../assets/pages/badge_3.png'
import badge_lock1 from '../assets/pages/badge_lock1.png'
import badge_lock2 from '../assets/pages/badge_lock2.png'
import pnl_card4 from '../assets/pages/pnl_card4.png'
import pnl_row6 from '../assets/pages/pnl_row6.png'
import pnl_row6v from '../assets/pages/pnl_row6v.png'
import pnl_pill32 from '../assets/pages/pnl_pill32.png'

import bg_quests from '../assets/pages/bg_quests.webp'
import bg_shop from '../assets/pages/bg_shop.webp'
import bg_league from '../assets/pages/bg_league.webp'
import bg_profile from '../assets/pages/bg_profile.webp'

const ART = {
  qi_star, qi_potion, qi_crystal, qi_chest, qi_flame,
  ui_card_wide, btn_gold, chip_violet, switch_seg,
  gem_s, gem_m, gem_l, gem_xl,
  chest_wood, chest_silver, chest_epic, chest_open,
  panel_banner, card_square, btn_green, ribbon_gold,
  tier_1, tier_2, tier_3, tier_4, tier_5,
  rank_gold, rank_silver, rank_bronze, trophy_big,
  podium, card_stat, btn_edit, panel_wide,
  badge_1, badge_2, badge_3, badge_lock1, badge_lock2,
  pnl_card4, pnl_row6, pnl_row6v, pnl_pill32,
}
export type ArtName = keyof typeof ART
export const art = (n: ArtName) => ART[n]

export const PAGE_BG = { quests: bg_quests, shop: bg_shop, league: bg_league, profile: bg_profile }

// Painted aspect ratios (width / height), measured from the sliced PNGs. A
// panel is locked to its own ratio so it can only ever scale uniformly.
export const ASPECT: Record<string, number> = {
  ui_card_wide: 2.764, btn_gold: 2.149, chip_violet: 1.989, switch_seg: 2.653,
  panel_banner: 2.166, card_square: 0.996, btn_green: 2.24, ribbon_gold: 2.595,
  row_white: 2.247, row_violet: 2.08, podium: 1.315, card_stat: 1.016,
  btn_edit: 2.164, panel_wide: 1.819,
  pnl_card4: 4, pnl_row6: 6, pnl_row6v: 6, pnl_pill32: 3.2,
}

/**
 * A painted panel: the art is the background, children sit on an absolute layer
 * over it so overflowing art can never grow the box and break its ratio.
 * `className` styles the panel itself (where it sits, how big it is);
 * `inner` styles the content layer (how the children are laid out).
 */
export function Panel({ name, className, inner, style, children, onClick, disabled }: {
  name: ArtName; className?: string; inner?: string; style?: CSSProperties
  children?: ReactNode; onClick?: () => void; disabled?: boolean
}) {
  const Tag = (onClick ? 'button' : 'div') as 'button'
  return (
    <Tag className={`pnl${className ? ' ' + className : ''}`} onClick={onClick} disabled={disabled}
      style={{ backgroundImage: `url(${ART[name]})`, aspectRatio: String(ASPECT[name] ?? 1), ...style }}>
      <span className={`pnl-in${inner ? ' ' + inner : ''}`}>{children}</span>
    </Tag>
  )
}

export function Art({ name, size, className, style }: {
  name: ArtName; size?: number; className?: string; style?: CSSProperties
}) {
  return <img src={ART[name]} alt="" draggable={false} className={className}
    style={{ width: size, height: 'auto', display: 'block', ...style }} />
}
