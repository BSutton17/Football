// Converts authored px → vmin at build time so the HUD/menu/sidebar chrome scales with the screen
// while we keep writing plain px in index.css. The canvas field is drawn separately (renderer.ts'
// own yardPx/camera math) and is unaffected by any of this.
//
// What is intentionally NOT converted:
//   • border* (borders + border-radius) — 1px hairlines go blurry/invisible in vmin, small radii
//     scale oddly. Left as px.
//   • box-shadow / outline — blur radii in vmin are erratic.
//   • anything < minPixelValue (1px hairlines that slip past the propList).
//   • px inside @media blocks (mediaQuery:false) — the mobile overrides were hand-tuned in px for
//     their breakpoint; converting them would re-scale that careful layout. Breakpoint conditions
//     (e.g. max-height:600px) are never touched regardless.
//
// THE ONE KNOB: viewportWidth is the baseline. value_in_vmin = px / viewportWidth * 100, so at
// 800 → 8px = 1vmin. On a screen whose SMALLER dimension is 800px the chrome renders at its current
// px sizes; smaller screens scale it down, larger up. If the UI feels too big/small everywhere,
// change ONLY this number (raise it to shrink, lower it to grow).
export default {
  plugins: {
    'postcss-px-to-viewport-8-plugin': {
      unitToConvert:  'px',
      viewportUnit:   'vmin',
      fontViewportUnit: 'vmin',   // the few px font-sizes too (most text is already rem)
      viewportWidth:  800,
      unitPrecision:  4,
      minPixelValue:  2,          // leave 1px hairlines as px
      propList:       ['*', '!border*', '!box-shadow', '!outline*'],
      mediaQuery:     false,      // don't re-scale the hand-tuned @media (max-*) overrides
    },
  },
}
