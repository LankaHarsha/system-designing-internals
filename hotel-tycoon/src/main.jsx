import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Lab from './lab/Lab'
import * as engine from './game/engine'
import { useGame } from './game/store'
import { camApi } from './scene/Scene'
import './styles.css'

window.addEventListener('beforeunload', engine.save)
// handy for tinkering from the dev console
window.hotel = { ...engine, ui: useGame, cam: camApi }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('lab') ? <Lab /> : <App />}
  </StrictMode>
)
