import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Status bar transparente + ícones brancos. NÃO setar overlaysWebView:false
// (isso desliga edge-to-edge e volta a mostrar a faixa cinza do sistema).
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => { })
    StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => { })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
