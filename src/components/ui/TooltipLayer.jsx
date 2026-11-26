// ── One portal tooltip for every [data-tooltip] element ────
// Never clipped by scrolling containers. 350ms delay, instant when moving
// to a neighbour, immediate on keyboard focus, hidden on scroll and
// pointer-down, hidden while the element's menu is open, kept in viewport.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const TooltipLayer = () => {
  const [tip, setTip] = useState(null) // { text, rect, align }
  const ref = useRef(null)

  useEffect(() => {
    let timer = 0
    let current = null
    let shown = false
    let lastHidden = 0
    const hide = () => {
      clearTimeout(timer)
      if (shown) lastHidden = Date.now()
      current = null
      shown = false
      setTip(null)
    }
    const show = (el) => {
      const text = el.getAttribute('data-tooltip')
      if (!text || el.getAttribute('aria-expanded') === 'true' || !el.isConnected) return
      shown = true
      setTip({ text, rect: el.getBoundingClientRect(), align: el.getAttribute('data-tooltip-align') })
    }
    const schedule = (el, delay) => {
      clearTimeout(timer)
      current = el
      timer = setTimeout(() => show(el), delay)
    }
    const onOver = (e) => {
      const el = e.target.closest?.('[data-tooltip]')
      if (el === current) return
      if (!el) { hide(); return }
      const instant = shown || Date.now() - lastHidden < 300
      hide()
      schedule(el, instant ? 0 : 350)
    }
    const onOut = (e) => { if (!e.relatedTarget) hide() }
    const onFocus = (e) => {
      const el = e.target.closest?.('[data-tooltip]')
      if (el && el.matches(':focus-visible')) schedule(el, 0)
    }
    const onKey = (e) => { if (e.key === 'Escape') hide() }
    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Place below (or above when there's no room), clamped to the viewport
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !tip) return
    const { rect, align } = tip
    const w = el.offsetWidth, h = el.offsetHeight, gap = 6, pad = 8
    let left = align === 'start' ? rect.left : align === 'end' ? rect.right - w : rect.left + rect.width / 2 - w / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad))
    let top = rect.bottom + gap
    if (top + h > window.innerHeight - pad) top = rect.top - h - gap
    el.style.left = `${Math.round(left)}px`
    el.style.top = `${Math.round(top)}px`
    el.style.visibility = 'visible'
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={ref} className="tooltip" role="tooltip" style={{ visibility: 'hidden' }}>{tip.text}</div>,
    document.body,
  )
}
