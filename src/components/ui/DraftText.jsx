// ── Text field with a local draft and debounced commits ────
// Typing stays local (so native undo inside the field keeps working);
// the value is committed after a pause and on blur, and any pending
// edit is flushed if the field unmounts (e.g. switching tasks).
import { useEffect, useRef, useState } from 'react'

export const DraftText = ({ value, onCommit, as: Tag = 'textarea', delay = 600, ...rest }) => {
  const [draft, setDraft] = useState(value)
  const [base, setBase] = useState(value)
  const [focused, setFocused] = useState(false)
  const pending = useRef(null) // latest uncommitted text, or null
  const timer = useRef(0)
  const commitRef = useRef(onCommit)
  useEffect(() => { commitRef.current = onCommit })

  // Outside change (another tab, undo): adopt it unless the user is typing
  if (value !== base) {
    setBase(value)
    if (!focused) setDraft(value)
  }

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current != null) {
      const v = pending.current
      pending.current = null
      commitRef.current(v)
    }
  }

  useEffect(() => () => flush(), [])

  return (
    <Tag
      {...rest}
      value={draft}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); flush(); rest.onBlur?.(e) }}
      onChange={(e) => {
        const v = e.target.value
        setDraft(v)
        pending.current = v
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, delay)
      }}
    />
  )
}
