import type { CSSProperties } from 'react'
// Sky-world art: generated from the admin's reference screenshot with gpt-image
// and sliced to transparent PNGs (pipeline/sky).
import token_open from '../assets/sky/token_open.png'
import token_locked from '../assets/sky/token_locked.png'
import pill_current from '../assets/sky/pill_current.png'
import portal from '../assets/sky/portal.png'
import steps from '../assets/sky/steps.png'
import island from '../assets/sky/island.png'
import waterfall from '../assets/sky/waterfall.png'
import cloud from '../assets/sky/cloud.png'
import balloon from '../assets/sky/balloon.png'
import path_seg from '../assets/sky/path_seg.png'
import tree_pink from '../assets/sky/tree_pink.png'
import tree_purple from '../assets/sky/tree_purple.png'
import crystal_blue from '../assets/sky/crystal_blue.png'
import crystal_pink from '../assets/sky/crystal_pink.png'
import bush from '../assets/sky/bush.png'
import rocks from '../assets/sky/rocks.png'
import flowers from '../assets/sky/flowers.png'
import pill from '../assets/sky/pill.png'
import ic_energy from '../assets/sky/ic_energy.png'
import ic_heart from '../assets/sky/ic_heart.png'
import ic_gem from '../assets/sky/ic_gem.png'
import ic_coin from '../assets/sky/ic_coin.png'
import btn_gear from '../assets/sky/btn_gear.png'
import nav_home from '../assets/sky/nav_home.png'
import nav_quests from '../assets/sky/nav_quests.png'
import nav_shop from '../assets/sky/nav_shop.png'
import nav_league from '../assets/sky/nav_league.png'
import nav_profile from '../assets/sky/nav_profile.png'
import card_daily from '../assets/sky/card_daily.png'
import dropdown from '../assets/sky/dropdown.png'
import widget_chest from '../assets/sky/widget_chest.png'
import btn_side from '../assets/sky/btn_side.png'
import ic_mail from '../assets/sky/ic_mail.png'
import ic_events from '../assets/sky/ic_events.png'
import ic_friends from '../assets/sky/ic_friends.png'

const MAP = {
  token_open, token_locked, pill_current,
  portal, steps, island, waterfall, cloud, balloon, path_seg,
  tree_pink, tree_purple, crystal_blue, crystal_pink, bush, rocks, flowers,
  pill, ic_energy, ic_heart, ic_gem, ic_coin, btn_gear,
  nav_home, nav_quests, nav_shop, nav_league, nav_profile,
  card_daily, dropdown, widget_chest, btn_side,
  ic_mail, ic_events, ic_friends,
}
export type SkyName = keyof typeof MAP
export const skySrc = (name: SkyName) => MAP[name]

export function SkyIcon({ name, size = 24, className, style }: {
  name: SkyName; size?: number; className?: string; style?: CSSProperties
}) {
  return (
    <img src={MAP[name]} width={size} height={size} alt="" draggable={false}
      className={className}
      style={{ objectFit: 'contain', display: 'block', ...style }} />
  )
}
