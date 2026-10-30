# Glass Addendum (supplements MASTER.md; wins only on glass effect, status colors, dark mode)

## Glass tokens (light)
--glass-bg: rgba(255,255,255,0.62)
--glass-border: rgba(255,255,255,0.70)
--glass-blur: 20px
--glass-saturate: 170%
--glass-highlight: inset 0 1px 0 rgba(255,255,255,0.80)
--glass-shadow: 0 8px 32px rgba(28,25,23,0.12)
Surface: backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: var(--glass-highlight), var(--glass-shadow); border-radius 20px (cards), 28px (modals).

## Glass tokens (dark)
--glass-bg: rgba(28,25,23,0.55)
--glass-border: rgba(255,255,255,0.14)
--glass-highlight: inset 0 1px 0 rgba(255,255,255,0.18)
--glass-shadow: 0 8px 32px rgba(0,0,0,0.45)
Dark surfaces use foreground #FAFAF9; keep body text at 4.5:1 or better.

## Page background (required so glass is visible)
Static layered gradient of #FAFAF9 to a warm stone tint (light) or #0C0A09 to #1C1917 (dark), plus 2 to 3 large blurred blobs in gold (#A16207 at 25% opacity) and stone (#78716C at 20%). Static, no animation.

## Status colors (chip = tinted glass + icon + text label, never color alone)
Active: text #166534, tint rgba(22,163,74,0.14), icon check
Expiring Soon: text #92400E, tint rgba(217,119,6,0.16), icon clock
Expired: text #991B1B, tint rgba(220,38,38,0.14), icon alert
In dark mode, lighten text to #86EFAC, #FCD34D, #FCA5A5.

## Typography rule
Cormorant only for headings 24px and up at weight 600 or higher (its thin strokes fail over blur). Montserrat for everything else, including chips, numbers, buttons and form labels.

## Component overrides
Replace the solid card, modal and input backgrounds in MASTER with the glass surface above. Navbar is glass with a bottom border. Modal overlay: rgba(0,0,0,0.4) with blur(6px). Hover: translateY(-2px) only. Active press scale of 0.98 is allowed on buttons only.

