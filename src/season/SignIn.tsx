import { useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { saveAuth, type AuthRecord } from './authStore.ts'
import { SERVER_URL } from '../socket/index.ts'

// ── Signing in ([auth]) ─────────────────────────────────────────────────────
//
// One flow everywhere, built for the hardest case. An app saved to an iPhone's home screen cannot run
// Google's sign-in itself: what opens to do it has separate storage and cannot reliably talk back. So:
// make up a one-time id, open /login.html with it, and ask the server for the result until it arrives.
// That works whichever browser the phone chooses to open, and on a desktop it is just a popup.

const HANDOFF_KEY = 'ef2_auth_handoff'
const POLL_MS = 2000

function newHandoffId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

interface Props {
  onSignedIn: (record: AuthRecord) => void
  onBack: () => void
}

export default function SignIn({ onSignedIn, onBack }: Props) {
  const [handoffId, setHandoffId] = useState<string | null>(() => {
    try { return localStorage.getItem(HANDOFF_KEY) } catch { return null }
  })
  const [blocked, setBlocked] = useState(false)
  const [copied, setCopied] = useState(false)

  const signedInRef = useRef(onSignedIn)
  signedInRef.current = onSignedIn

  // Ask until it arrives. Also straight away on coming back to the app, because timers do not run while
  // the phone is showing somebody else.
  useEffect(() => {
    if (!handoffId) return
    let stopped = false
    async function poll() {
      try {
        const r = await api.handoff(handoffId!)
        if (stopped || r.status !== 'done') return
        stopped = true
        try { localStorage.removeItem(HANDOFF_KEY) } catch { /* nothing to clean up */ }
        const record = { token: r.token, user: r.user }
        saveAuth(record)
        signedInRef.current(record)
      } catch { /* the next poll will try again */ }
    }
    void poll()
    const id = window.setInterval(poll, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void poll() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [handoffId])

  const loginUrl = (id: string) => `${window.location.origin}/login.html?h=${id}`

  function start() {
    const id = newHandoffId()
    try { localStorage.setItem(HANDOFF_KEY, id) } catch { /* it still works until a relaunch */ }
    setHandoffId(id)
    // Has to happen inside the tap, or the browser calls it a popup and blocks it.
    const win = window.open(loginUrl(id), '_blank')
    setBlocked(!win)
  }

  function restart() {
    try { localStorage.removeItem(HANDOFF_KEY) } catch { /* nothing to clean up */ }
    setHandoffId(null)
    setBlocked(false)
  }

  async function copyLink() {
    if (!handoffId) return
    try {
      await navigator.clipboard.writeText(loginUrl(handoffId))
      setCopied(true)
    } catch { /* the link is on screen to copy by hand */ }
  }

  async function devLogin() {
    const record = await api.devLogin('Dev Player')
    saveAuth(record)
    onSignedIn(record)
  }

  return (
    <div className="season-screen season-center">
      <div className="season-signin">
        <div className="season-kicker">One team. One real schedule.</div>
        <h1 className="season-title">Seasons</h1>
        <p className="season-muted">
          Sign in so your seasons are saved to your account. You stay signed in on this device, even after
          closing the app.
        </p>

        {!handoffId && (
          <button className="season-google" onClick={start}>
            <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
              <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l8-6.2z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.4 2.2-6.2 0-11.5-4.1-13.4-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Sign in with Google
          </button>
        )}

        {handoffId && (
          <div className="season-waiting">
            <div className="season-spinner" aria-hidden />
            <p>Finish signing in with Google, then come back here.</p>
            {blocked && (
              <button className="season-btn" onClick={() => { window.location.href = `${loginUrl(handoffId)}&return=1` }}>
                Open sign-in
              </button>
            )}
            <p className="season-muted season-small">
              Nothing opened? Open this link in Safari, and this screen will carry on by itself.
            </p>
            <div className="season-linkrow">
              <button className="season-btn season-btn--ghost" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
              <button className="season-btn season-btn--ghost" onClick={restart}>Start over</button>
            </div>
          </div>
        )}

        {import.meta.env.DEV && SERVER_URL.includes('localhost') && (
          <button className="season-btn season-btn--ghost" data-testid="dev-login" onClick={devLogin}>Dev login</button>
        )}
        <button className="season-link" onClick={onBack}>Back</button>
      </div>
    </div>
  )
}
