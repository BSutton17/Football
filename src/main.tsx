import { createRoot } from 'react-dom/client'
import { lazy, Suspense } from 'react'
import './index.css'
import './screens.css'   // Team Select + VS/loading screens — vmin-scaled (scoped PostCSS), loaded after index.css
import App from './App.tsx'

// [authored] The play sandbox lives at ?sandbox=1 and is DEV-ONLY.
//
// ⚠️ `import.meta.env.DEV` IS THE WHOLE POINT, not the query string. Vite replaces it with a
// literal `false` in a production build, so this branch — and the dynamic import inside it — is
// dead code the bundler drops entirely. The sandbox is therefore absent from the deployed site
// rather than merely hidden behind a URL nobody guesses.
//
// Gating on the query string alone would have shipped the whole authoring UI to players: dead,
// because the API it talks to is loopback-only and never mounted in production, but present and
// reachable by anyone who typed ?sandbox=1. The AI ships; the tools that author it do not.
function Root() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('sandbox')) {
    const Sandbox = lazy(() => import('./sandbox/Sandbox.tsx'))
    return <Suspense fallback={null}><Sandbox /></Suspense>
  }
  return (
    <>
      <App />
      <SandboxLink />
    </>
  )
}

// A way in that is not "remember the query string". Inside the same DEV guard, so it is dropped
// from a production build along with everything else the sandbox touches.
function SandboxLink() {
  if (!import.meta.env.DEV) return null
  return (
    <a
      href="?sandbox=1"
      title="Open the play sandbox (dev only)"
      style={{
        position: 'fixed', right: 10, bottom: 10, zIndex: 9999,
        background: '#24402c', color: '#e8ecf1', border: '1px solid #3d7a4e',
        borderRadius: 6, padding: '5px 11px', fontSize: 12, fontWeight: 600,
        fontFamily: 'system-ui, sans-serif', textDecoration: 'none', opacity: 0.85,
      }}
    >
      ✎ Sandbox
    </a>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
