import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import './index.css'

// Inject skip-to-content link before React mounts (accessible before JS)
const skipLink = document.createElement('a')
skipLink.href = '#main-content'
skipLink.className = 'skip-link'
skipLink.textContent = 'Skip to main content'
document.body.prepend(skipLink)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
)
