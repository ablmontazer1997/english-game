import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/global.css'
import { GameProvider } from './services/ServiceProvider'
import { App } from './App'
import { initAudio } from './services/audio'

initAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
)
