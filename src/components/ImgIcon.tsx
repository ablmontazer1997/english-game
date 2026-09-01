import type { CSSProperties } from 'react'
// Real hand-painted game icons (admin-provided, extracted to transparent PNGs).
import shop from '../assets/nav/shop.png'
import inventory from '../assets/nav/inventory.png'
import map from '../assets/nav/map.png'
import quests from '../assets/nav/quests.png'
import profile from '../assets/nav/profile.png'
// Gem-framed currency + resource icons (UI kit sheet → sliced).
import heart from '../assets/ui/currency/heart.png'
import potion from '../assets/ui/currency/potion.png'
import coin from '../assets/ui/currency/coin.png'
import gem from '../assets/ui/currency/gem.png'
import star from '../assets/ui/currency/star.png'
import bolt from '../assets/ui/currency/bolt.png'
// Ornate rune icon-buttons (close / back / settings / add / sound / pause).
import ib_close from '../assets/ui/iconbtn/ib_close.png'
import ib_back from '../assets/ui/iconbtn/ib_back.png'
import ib_settings from '../assets/ui/iconbtn/ib_settings.png'
import ib_add from '../assets/ui/iconbtn/ib_add.png'
import ib_sound from '../assets/ui/iconbtn/ib_sound.png'
import ib_pause from '../assets/ui/iconbtn/ib_pause.png'
// Reward / status props.
import chest_closed from '../assets/ui/rewards/chest_closed.png'
import chest_open from '../assets/ui/rewards/chest_open.png'
import stars3 from '../assets/ui/rewards/stars3.png'
import lock_closed from '../assets/ui/rewards/lock_closed.png'
import lock_open from '../assets/ui/rewards/lock_open.png'
import badge from '../assets/ui/rewards/badge.png'

const MAP = {
  shop, inventory, map, quests, profile,
  heart, potion, coin, gem, star, bolt,
  ib_close, ib_back, ib_settings, ib_add, ib_sound, ib_pause,
  chest_closed, chest_open, stars3, lock_closed, lock_open, badge,
}
export type IconName = keyof typeof MAP

export function ImgIcon({ name, size = 24, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties
}) {
  return (
    <img src={MAP[name]} width={size} height={size} alt="" draggable={false}
      className={className}
      style={{ objectFit: 'contain', display: 'block', ...style }} />
  )
}
