import { useEffect, useRef, useState } from 'react'
import type { PuntReturnDecision, PuntReturnOption } from '../types/game.ts'
import { sendPuntReturnChoice } from '../socket/index.ts'

interface Props {
  decision: PuntReturnDecision
}

// [Special Teams][28][29] The receiving team's punt menu: Return / Fair Catch / Let It Bounce. Shown
// only for an IN-FIELD punt — an end-zone or out-of-bounds punt never reaches here ([29]). A local
// countdown mirrors the server's timer; the server is authoritative and auto-picks the default on
// expiry, so this is display only. Sending a choice locks the buttons (the result clears the menu).
export default function PuntReturnMenu({ decision }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(decision.secondsRemaining)
  const [sent, setSent] = useState(false)
  const sentRef = useRef(false)

  useEffect(() => {
    setSecondsLeft(decision.secondsRemaining)
    setSent(false)
    sentRef.current = false
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [decision])

  function choose(option: PuntReturnOption) {
    if (sentRef.current) return
    sentRef.current = true
    setSent(true)
    sendPuntReturnChoice(option)
  }

  return (
    <div className="fourth-down" role="dialog" aria-label="Punt return decision">
      <div className="fourth-down__header">
        <span className="fourth-down__title">Punt Incoming</span>
        <span className="fourth-down__timer">{secondsLeft}</span>
      </div>
      <div className="fourth-down__options">
        {decision.options.map(o => {
          const isDefault = o.id === decision.defaultOption
          return (
            <button
              key={o.id}
              className={`fourth-down__btn${isDefault ? ' fourth-down__btn--default' : ''}`}
              disabled={!o.legal || sent}
              onPointerDown={() => choose(o.id)}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
