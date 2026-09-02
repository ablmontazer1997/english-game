import type { CSSProperties } from 'react'
// Real hand-painted game icons (admin-provided, extracted to transparent PNGs).
import shop from '../assets/nav/shop.webp'
import inventory from '../assets/nav/inventory.webp'
import map from '../assets/nav/map.webp'
import quests from '../assets/nav/quests.webp'
import profile from '../assets/nav/profile.webp'
// Gem-framed currency + resource icons (UI kit sheet → sliced).
import heart from '../assets/ui/currency/heart.webp'
import potion from '../assets/ui/currency/potion.webp'
import coin from '../assets/ui/currency/coin.webp'
import gem from '../assets/ui/currency/gem.webp'
import star from '../assets/ui/currency/star.webp'
import bolt from '../assets/ui/currency/bolt.webp'
// Ornate rune icon-buttons (close / back / settings / add / sound / pause).
import ib_close from '../assets/ui/iconbtn/ib_close.webp'
import ib_back from '../assets/ui/iconbtn/ib_back.webp'
import ib_settings from '../assets/ui/iconbtn/ib_settings.webp'
import ib_add from '../assets/ui/iconbtn/ib_add.webp'
import ib_sound from '../assets/ui/iconbtn/ib_sound.webp'
import ib_pause from '../assets/ui/iconbtn/ib_pause.webp'
// Reward / status props.
import chest_closed from '../assets/ui/rewards/chest_closed.webp'
import chest_open from '../assets/ui/rewards/chest_open.webp'
import stars3 from '../assets/ui/rewards/stars3.webp'
import lock_closed from '../assets/ui/rewards/lock_closed.webp'
import lock_open from '../assets/ui/rewards/lock_open.webp'
import badge from '../assets/ui/rewards/badge.webp'

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
