import React from 'react'
import ReactDOM from 'react-dom/client'
import OverlayApp from './overlay/OverlayApp'
import './assets/main.css'

// Enforce 100% transparent root background for overlay window
try {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  document.body.style.backgroundColor = 'transparent'
} catch {}

ReactDOM.createRoot(document.getElementById('overlay-root') as HTMLElement).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
)
