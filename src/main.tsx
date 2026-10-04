import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/global.css'
import { GameProvider } from './services/ServiceProvider'
import { App } from './App'
import { initAudio } from './services/audio'
import { SpellLetter } from './components/SpellLetter'
import { Btn } from './components/PageArt'
import stageBg from './assets/stage_bg.webp'
import './screens/stage.css'

initAudio()

// TEST BUILDS ONLY: ?font=1|2|3 previews a candidate type pairing (self-hosted, SIL OFL, public/fonts-test).
// The admin picks one; until then the app keeps Cinzel + Baloo 2 + Nunito.
const FONT_SETS: Record<string, [string, string, string]> = {
  '1': ["'Lilita One', cursive", "'Baloo 2', 'Nunito', sans-serif", "'Nunito', system-ui, sans-serif"],
  '2': ["'Fredoka', sans-serif", "'Fredoka', sans-serif", "'Quicksand', system-ui, sans-serif"],
  '3': ["'Cinzel Decorative', serif", "'Baloo 2', 'Nunito', sans-serif", "'Nunito', system-ui, sans-serif"],
}
const fontSet = import.meta.env.BASE_URL.includes('-test') ? FONT_SETS[new URLSearchParams(location.search).get('font') ?? ''] : undefined
if (fontSet) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `${import.meta.env.BASE_URL}fonts-test/fonts.css`; document.head.appendChild(l)
  const st = document.createElement('style')
  st.textContent = `:root{--display:${fontSet[0]};--game:${fontSet[1]};--sans:${fontSet[2]}}`
  document.head.appendChild(st)
}

// TEST BUILDS ONLY: ?letter=<topic id>&lv=B2 shows one Spellbook letter on its own (layout checks for all 116 topics)
const letterId = import.meta.env.BASE_URL.includes('-test') ? new URLSearchParams(location.search).get('letter') : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {letterId ? (
      <div className="stage-host full">
        <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
        <div className="sl-lobby"><SpellLetter topicId={letterId} level={new URLSearchParams(location.search).get('lv') ?? 'A1'} />
          <Btn className="lg sl-start">Start</Btn></div>
      </div>
    ) : (
      <GameProvider>
        <App />
      </GameProvider>
    )}
  </StrictMode>,
)
