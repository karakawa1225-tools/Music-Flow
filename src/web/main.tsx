import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from '@renderer/App'
import { AuthGate } from '@renderer/cloud/AuthGate'
import { createWebMusicFlowApi } from '@renderer/cloud/createWebApi'
import '@renderer/styles/globals.css'

window.musicFlow = createWebMusicFlowApi()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthGate>
      <App />
    </AuthGate>
  </BrowserRouter>
)
