import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Terminal fonts (monospace)
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/source-code-pro/400.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/space-mono/400.css'
import '@azurity/pure-nerd-font/pure-nerd-font.css'
// App/UI fonts (sans-serif)
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/geist/400.css'
import '@fontsource/geist/500.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/ubuntu/400.css'
import '@fontsource/ubuntu/500.css'
import { initFileDropHandler } from './utils/file-drop-handler'

// Initialize document-level file drop handler
// Must be done before React renders to ensure consistent event handling
initFileDropHandler()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
