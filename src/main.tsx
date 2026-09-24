import { createRoot } from 'react-dom/client'
import { lazy, Suspense } from 'react'
import './index.css'
import './screens.css'   // Team Select + VS/loading screens — vmin-scaled (scoped PostCSS), loaded after index.css
import App from './App.tsx'

// [authored] The play sandbox lives at ?sandbox=1. It is lazy so it never enters the game bundle:
// it talks to a loopback-only dev endpoint that does not exist in a deployed build, and shipping
// it to players would be dead weight at best.
const Sandbox = lazy(() => import('./sandbox/Sandbox.tsx'))
const wantsSandbox = new URLSearchParams(window.location.search).has('sandbox')

createRoot(document.getElementById('root')!).render(
  wantsSandbox
    ? <Suspense fallback={null}><Sandbox /></Suspense>
    : <App />,
)
