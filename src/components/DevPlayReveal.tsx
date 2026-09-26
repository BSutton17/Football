import type { DevReveal } from '../types/game.ts'

// [dev reveal] What the computer called this play — the NAME of it, and nothing else.
//
// ⚠️ DEV BUILDS ONLY, AND THE SERVER MUST OPT IN TOO. The server attaches the reveal only outside
// production, only with ENABLE_DEV_REVEAL=1, and only in a solo room; this component additionally
// renders nothing unless `import.meta.env.DEV`, so the whole path is dead in a shipped build and the
// "defense never sees the play call" rule is untouched.
//
// ⚠️ IT USED TO DRAW THE PLAYERS TOO, AND THAT WAS THE MISTAKE. It laid its own art over the field —
// a chip per man, a hollow ring per zone — on top of a canvas that already knows how to draw cloud
// flats, deep zones, dashed man lines and blitz arrows. The result looked nothing like the game,
// which made it hard to read and impossible to compare against a real defensive call. (The SHELLS
// panel had the same fault, for the same reason: inventing a picture instead of reusing the one that
// exists.)
//
// The computer's assignments now go through `revealCoverage` into the SAME props the defense's own
// coverage uses, so `drawFrame` renders them with the real art. Nothing is drawn here any more. If
// something about the computer's call needs showing that the field art genuinely cannot say, it
// belongs in this banner as words — not as a second set of shapes over the top of the first.
export default function DevPlayReveal({ reveal }: { reveal: DevReveal }) {
  if (!import.meta.env.DEV) return null

  const side = reveal.aiRole === 'offense' ? reveal.play : reveal.shell
  if (!side) return null

  return (
    <div className="dev-reveal-head" aria-hidden="true">
      <span className="dev-reveal-tag">AI {reveal.aiRole}</span>
      <span className="dev-reveal-name">{side.name ?? '(unnamed)'}</span>
      {reveal.aiRole === 'offense' && reveal.play?.playType && (
        <span className="dev-reveal-kind">{reveal.play.playType}</span>
      )}
    </div>
  )
}
