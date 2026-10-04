import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/global.css'
import { GameProvider } from './services/ServiceProvider'
import { App } from './App'
import { initAudio } from './services/audio'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
)
