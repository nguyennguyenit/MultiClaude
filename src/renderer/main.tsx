import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { initFileDropHandler } from './utils/file-drop-handler'

// Initialize document-level file drop handler
// Must be done before React renders to ensure consistent event handling
initFileDropHandler()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
