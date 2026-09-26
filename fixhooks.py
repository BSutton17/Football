import io, re

p = 'src/App.tsx'
raw = io.open(p, encoding='utf-8').read()
lines = raw.split('\n')
before = len(lines)

# ── locate the block precisely ──────────────────────────────────────────────
# `const situationKey =` is unique; walk back over its comment banner, forward to the last effect.
keyline = [i for i, l in enumerate(lines) if l.strip().startswith('const situationKey =')]
assert len(keyline) == 1, keyline
start = keyline[0]
while start > 0 and (lines[start - 1].strip().startswith('//') or lines[start - 1].strip() == ''):
    start -= 1
    if lines[start].strip() == '' and not lines[start - 1].strip().startswith('//'):
        break

endline = [i for i, l in enumerate(lines) if "if (phase === 'live') setPickerOpen(false)" in l]
assert len(endline) == 1, endline
end = endline[0]
assert start < end and end - start < 60, (start, end)

block = [l.replace('|${role}`', '|${pickerRole}`').rstrip('\r') for l in lines[start:end + 1]]
if end + 1 < len(lines) and lines[end + 1].strip() == '':
    end += 1

# ── the note that keeps it there ────────────────────────────────────────────
block = block[:1] + [
    "  //",
    "  // ⚠️ THESE LIVE ABOVE THE EARLY RETURNS, AND THAT IS NOT A STYLE CHOICE. This component",
    "  // returns early for the lobby, team select and the VS screen, so a hook placed after those",
    "  // returns runs on some renders and not others. React counted a different number of hooks",
    "  // before and after the room went ready and threw error #310, which took single player down",
    "  // at kickoff. Every hook belongs above the first `return`, no exceptions.",
    "  //",
    "  // `role` is derived here rather than reused from below for the same reason: it is declared",
    "  // after the returns, so reaching for it would drag this back down with it.",
    "  const pickerRole = room.role ?? 'offense'",
] + block[1:]

del lines[start:end + 1]

anchor = [i for i, l in enumerate(lines)
          if l.startswith('  useEffect(') and i + 1 < len(lines)
          and "phase !== 'pre_snap'" in lines[i + 1]]
assert len(anchor) == 1, anchor
lines[anchor[0]:anchor[0]] = block + ['']

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))

# ── verify ──────────────────────────────────────────────────────────────────
s = io.open(p, encoding='utf-8').read().split('\n')
assert abs(len(s) - before) <= 12, 'line count moved too much: %d -> %d' % (before, len(s))
first_ret = next(i for i, l in enumerate(s, 1) if re.match(r'^  (if \(.*\) return|return \()', l))
bad = [(i, l.strip()[:70]) for i, l in enumerate(s, 1)
       if re.match(r'^  use(Effect|Memo|Ref|State|Callback)', l) and i > first_ret]
print('lines %d -> %d' % (before, len(s)))
print('first early return at line', first_ret)
print('hooks below it:', len(bad))
for b in bad[:8]:
    print('   ', b[0], b[1].encode('ascii', 'replace').decode())
