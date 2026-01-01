import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Prevent Electron's default file drop behavior (navigating to file)
// This MUST be at document level to prevent the browser from handling drops
document.addEventListener('dragover', (e) => {
  e.preventDefault()
}, { capture: true })

document.addEventListener('drop', (e) => {
  e.preventDefault()
}, { capture: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
