import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Prevent Electron's default file drop behavior (navigating to file)
// Note: On Linux, DOM drag events may not fire from file manager drops
// File drops are handled via IPC from main process (will-navigate intercept)
document.body.addEventListener('dragover', (e) => {
  e.preventDefault()
}, { capture: true })

document.body.addEventListener('drop', (e) => {
  e.preventDefault()
}, { capture: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
