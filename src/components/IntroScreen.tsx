import { useEffect, useRef, useState, type ReactNode } from 'react'

// [intro] A pre-title splash: a muted background VIDEO plays under a SONG, with a "Press any button
// to continue" prompt. Pressing it starts the song (audio needs a user gesture — browsers block
// autoplay-with-sound), runs a faked 3–5s loading bar, then reveals the title screen. The <video>
// element and the song player are mounted ONCE and never remounted, so the video + song simply
// continue playing behind the title exactly where they left off.

// Local hype video in /public (YouTube embeds for the source clips are blocked). encodeURI handles
// the spaces in the filename.
const VIDEO_SRC = encodeURI('/202607021629.mp4')

const SONG_ID    = 'uytDWGa2-Vc'   // song (starts at 0:08)
const SONG_START = 0

// Load the YouTube IFrame API once (used only for the song audio) and resolve with the YT namespace.
let ytApiPromise: Promise<any> | null = null
function loadYouTubeApi(): Promise<any> {
  const w = window as any
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT) }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

type Phase = 'splash' | 'loading' | 'title'

export default function IntroScreen({ children }: { children: ReactNode }) {
  const [phase, setPhase]     = useState<Phase>('splash')
  const [barFill, setBarFill] = useState(0)   // 0 → 100 (%) drives the fake loading bar width
  const loadMsRef = useRef(0)
  const songRef   = useRef<any>(null)

  // Create the audio-only song player once. It's armed but only made audible on the button press.
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled) return
      songRef.current = new YT.Player('intro-song', {
        videoId: SONG_ID,
        playerVars: { autoplay: 0, controls: 0, start: SONG_START, playsinline: 1, iv_load_policy: 3 },
      })
    })
    return () => {
      cancelled = true
      try { songRef.current?.destroy?.() } catch { /* player already gone */ }
    }
  }, [])

  // First user gesture: start the song (audio now permitted), then run the fake loading bar.
  function begin() {
    if (phase !== 'splash') return
    try {
      const s = songRef.current
      s?.seekTo?.(SONG_START, true)
      s?.unMute?.()
      s?.setVolume?.(50)
      s?.playVideo?.()
    } catch { /* song not ready yet — the title still loads */ }

    loadMsRef.current = 3000 + Math.random() * 2000   // 3–5s
    setPhase('loading')
    // Kick the bar to 100% on the next frame so the CSS width transition animates the whole way.
    requestAnimationFrame(() => setBarFill(100))
    window.setTimeout(() => setPhase('title'), loadMsRef.current)
  }

  // "Press ANY button": accept a click/tap anywhere on the splash or any key.
  useEffect(() => {
    if (phase !== 'splash') return
    const onKey = () => begin()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div className="intro-root">
      {/* Muted background video — stays mounted behind everything, incl. the title screen. */}
      <video className="intro-video" src={VIDEO_SRC} autoPlay muted loop playsInline preload="auto" />
      {/* Audio-only song player (YouTube), kept off-screen. */}
      <div className="intro-song-holder"><div id="intro-song" /></div>

      {phase === 'title' ? (
        children
      ) : (
        <div
          className="intro-splash"
          onPointerDown={begin}
          role="button"
          tabIndex={0}
          aria-label="Press any button to continue"
        >
          <div className="intro-title">E-FOOTBALL</div>
          {phase === 'splash' ? (
            <div className="intro-prompt">Press any button to continue</div>
          ) : (
            <div className="intro-loading">
              <div className="intro-loading-label">Loading…</div>
              <div className="intro-loading-track">
                <div
                  className="intro-loading-fill"
                  style={{ width: `${barFill}%`, transitionDuration: `${loadMsRef.current}ms` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
