// ── Menus: dropdown (MenuButton / Menu) and ContextMenu ────
// role="menu"/"menuitem"; arrows, Home/End and type-ahead move focus;
// Enter/Space activate; Escape and Tab close and return focus; outside
// click closes; the popover is kept inside the viewport.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './IconButton.jsx'

// items: { label, icon, onSelect, danger, disabled, kbd, checked } | { separator: true } | { heading }
const MenuList = ({ items, onClose, anchor, point, placement = 'down', align = 'start', labelledBy, label, returnFocus }) => {
  const ref = useRef(null)

  const focusables = () => [...ref.current.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])')]

  // Position + first focus, before paint
  useLayoutEffect(() => {
    const el = ref.current
    const w = el.offsetWidth, h = el.offsetHeight, pad = 8
    let left, top
    if (point) { left = point.x; top = point.y }
    else {
      const r = anchor.getBoundingClientRect()
      left = align === 'end' ? r.right - w : r.left
      top = placement === 'up' ? r.top - h - 6 : r.bottom + 6
      if (placement !== 'up' && top + h > window.innerHeight - pad) top = r.top - h - 6
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad))
    top = Math.max(pad, Math.min(top, window.innerHeight - h - pad))
    el.style.left = `${Math.round(left)}px`
    el.style.top = `${Math.round(top)}px`
    el.style.visibility = 'visible'
    focusables()[0]?.focus()
  }, [anchor, point, placement, align])

  const close = useCallback((restore = true) => {
    onClose()
    if (restore) returnFocus?.focus?.()
  }, [onClose, returnFocus])

  // Outside click / resize / scroll elsewhere closes
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return
      close(false)
    }
    const onScroll = (e) => { if (!ref.current?.contains(e.target)) close(false) }
    const onResize = () => close(false)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [anchor, close])

  const onKeyDown = (e) => {
    const list = focusables()
    const i = list.indexOf(document.activeElement)
    const move = (n) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus() }
    if (e.key === 'ArrowDown') move(i + 1)
    else if (e.key === 'ArrowUp') move(i - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(list.length - 1)
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') { e.preventDefault(); close() }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase()
      const order = [...list.slice(i + 1), ...list.slice(0, i + 1)]
      order.find(el => el.textContent.trim().toLowerCase().startsWith(ch))?.focus()
    }
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className="menu anim-drop-in"
      style={{ visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={e => e.preventDefault()}
    >
      {items.filter(Boolean).map((item, i) => {
        if (item.separator) return <div key={i} role="separator" className="menu-sep" />
        if (item.heading) return <div key={i} role="presentation" className="menu-heading">{item.heading}</div>
        const Ic = item.icon
        const role = item.checked == null ? 'menuitem' : 'menuitemradio'
        return (
          <button
            key={i}
            type="button"
            role={role}
            aria-checked={item.checked == null ? undefined : item.checked}
            aria-disabled={item.disabled || undefined}
            tabIndex={-1}
            className={`menu-item${item.danger ? ' menu-item-danger' : ''}`}
            data-feat={item.danger ? 'danger' : item.feat}
            onClick={() => { if (item.disabled) return; close(); item.onSelect?.() }}
          >
            <span className="menu-item-icon">{Ic ? <Ic size={14} /> : item.swatch ? <span className="menu-swatch" style={{ background: item.swatch }} /> : null}</span>
            <span className="menu-item-label">{item.label}</span>
            {item.checked && <span className="menu-item-check" aria-hidden="true">✓</span>}
            {item.kbd && <kbd className="menu-kbd">{item.kbd}</kbd>}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

// Generic dropdown. `trigger` renders the button and receives props to spread.
export const Menu = ({ items, trigger, placement, align = 'start', label }) => {
  const [anchor, setAnchor] = useState(null) // the trigger element while open
  const id = useId()
  const props = {
    id,
    'aria-haspopup': 'menu',
    'aria-expanded': anchor != null,
    onClick: (e) => { const el = e.currentTarget; setAnchor(a => (a ? null : el)) },
    onKeyDown: (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAnchor(e.currentTarget) } },
  }
  return (
    <>
      {trigger(props, anchor != null)}
      {anchor && (
        <MenuList
          items={items}
          anchor={anchor}
          returnFocus={anchor}
          placement={placement}
          align={align}
          labelledBy={label ? undefined : id}
          label={label}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  )
}

// Icon-button trigger (label = aria-label = tooltip)
export const MenuButton = ({ label, icon, items, placement, align = 'end', buttonProps }) => (
  <Menu
    items={items}
    placement={placement}
    align={align}
    label={label}
    trigger={(props) => <IconButton label={label} icon={icon} tooltipAlign={align} {...buttonProps} {...props} />}
  />
)

// Positioned at a point (right-click / Shift+F10)
export const ContextMenu = ({ x, y, items, onClose, label, returnFocus }) => (
  <MenuList items={items} point={{ x, y }} onClose={onClose} label={label} returnFocus={returnFocus} />
)
