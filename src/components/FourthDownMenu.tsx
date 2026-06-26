import { useEffect, useRef, useState } from 'react'
import type { PlayDecision, DecisionOption } from '../types/game.ts'
import { sendDecision } from '../socket/index.ts'

interface Props {
  decision: PlayDecision
}

// [Special Teams][2][3][4] The 4th-down menu: Go For It / Punt / Field Goal. Legality comes from the
// server (illegal options are disabled). A local countdown mirrors the server's 5-second timer — the
// server is authoritative and auto-picks the default if it expires, so this is display only. Once a
// choice is sent the buttons lock (the resulting game_state clears the menu).
export default function FourthDownMenu({ decision }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(decision.secondsRemaining)
  const [sent, setSent] = useState(false)
  const sentRef = useRef(false)

  // Restart the local countdown each time a fresh decision arrives.
  useEffect(() => {
    setSecondsLeft(decision.secondsRemaining)
    setSent(false)
    sentRef.current = false
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [decision])

  function choose(option: DecisionOption) {
    if (sentRef.current) return
    sentRef.current = true
    setSent(true)
    sendDecision(option)
  }

  return (
    <div className="fourth-down" role="dialog" aria-label="Fourth down decision">
      <div className="fourth-down__header">
        <span className="fourth-down__title">4th Down</span>
        <span className="fourth-down__timer">{secondsLeft}</span>
      </div>
      <div className="fourth-down__options">
        {decision.options.map(o => {
          const isDefault = o.id === decision.defaultOption
          const label = o.id === 'field_goal' && o.legal
            ? `${o.label} · ${Math.round(decision.fieldGoalDistance)} yd`
            : o.label
          return (
            <button
              key={o.id}
              className={`fourth-down__btn${isDefault ? ' fourth-down__btn--default' : ''}`}
              disabled={!o.legal || sent}
              onPointerDown={() => choose(o.id)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
