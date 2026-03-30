// ── Speech recognition hook ────────────────────────────────
import { useState, useRef, useCallback } from 'react'

export const useSpeech = (onResult) => {
  const [listening, setListening] = useState(false)
  const recog = useRef(null)

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!supported || listening) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SpeechRecognition()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1

    r.onresult = (e) => {
      const text = e.results[0][0].transcript
      onResult(text)
      setListening(false)
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)

    recog.current = r
    r.start()
    setListening(true)
  }, [supported, listening, onResult])

  const stop = useCallback(() => {
    recog.current?.stop()
    setListening(false)
  }, [])

  return { listening, start, stop, supported }
}
