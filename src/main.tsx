import { createRoot } from 'react-dom/client'
import './index.css'
import './screens.css'   // Team Select + VS/loading screens — vmin-scaled (scoped PostCSS), loaded after index.css
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
