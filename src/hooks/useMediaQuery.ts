import { useEffect, useState } from 'react'

// Live media-query match. Rotating the phone has to re-evaluate it, which a one-shot read at mount
// never does — that is exactly how a roster collapsed in portrait stayed collapsed in landscape.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches)   // re-sync in case it changed between render and subscribe
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
