// px → vmin, SCOPED to just the intro screens. The plugin's `include` restricts conversion to
// src/screens.css only (Team Select .ts2-* + VS/loading .vs2-*); every other stylesheet — the whole
// in-game HUD/menus in index.css — is left in px, untouched. The canvas field has its own scaling.
//
// Not converted even within screens.css: border* (hairlines/radii) and box-shadow (erratic blur in
// vmin), plus anything below minPixelValue. @media blocks are left as-authored px.
//
// THE ONE KNOB: viewportWidth is the baseline. value_in_vmin = px / viewportWidth * 100, so at 800 →
// 8px = 1vmin. On a screen whose SMALLER dimension is 800px the screens render at their authored px
// sizes; smaller screens scale down, larger up. Raise this number to shrink everything, lower to grow.
export default {
  plugins: {
    'postcss-px-to-viewport-8-plugin': {
      unitToConvert:    'px',
      viewportUnit:     'vmin',
      fontViewportUnit: 'vmin',
      viewportWidth:    800,
      unitPrecision:    4,
      minPixelValue:    2,
      propList:         ['*', '!border*', '!box-shadow', '!outline*'],
      mediaQuery:       false,
      // This fork supports `exclude` only (no `include`). Exclude every file whose path does NOT end
      // in screens.css, so ONLY screens.css is ever converted — index.css and anything else stay px.
      exclude:          /^(?!.*screens\.css$).*$/,
    },
  },
}
