# WarrantyVault UI Design Notes

## Sources and rules

- `design-system/warrantyvault/MASTER.md` is the controlling design source. It sets a "Premium dark + gold accent" palette (`#1C1917`, `#A16207`, `#FAFAF9`, `#0C0A09`), Cormorant headings (24px and up, weight 600+) and Montserrat for body text, plus the 4px-to-64px spacing scale and four shadow depths. Its style is "Liquid Glass"; use restrained, refined hierarchy rather than playful or vibrant block layouts.
- The Master component guidance calls for a 200ms button transition, 8px button/input corners and subtle card lift, while its anti-pattern list requires Lucide-style SVG icons, pointer cursors, 150-300ms transitions, at least 4.5:1 text contrast, and visible focus states.
- `design-system/GLASS_ADDENDUM.md` overrides the Master only for glass effects, status colors and dark mode. Use its light glass surface (`rgba(255,255,255,0.62)`, 20px blur, 170% saturation, bright inset edge and soft shadow) and dark surface (`rgba(28,25,23,0.55)`, translucent border and highlight). Cards use 20px corners, modals 28px. Keep the page background static, with warm stone/dark gradients and gold/stone blurred blobs. Status chips pair a label with an icon and the specified green, amber or red tint; dark-mode text uses the addendum's lighter colors.
- `design-system/warrantyvault/pages/dashboard.md` is the only existing page override. It sets dashboard content to a centered 1200px max-width, full-width sections and no other deviations. No page override files exist for the other pages, so those use the Master plus the Addendum.
- `ui-ux-pro-max-skill/src/ui-ux-pro-max/data/stacks/react.csv` recommends semantic elements ("button for clicks nav for navigation") and form submission through `onSubmit`. `ui-ux-pro-max-skill/src/ui-ux-pro-max/data/stacks/html-tailwind.csv` recommends consistent input dimensions (`h-10 px-3`) and accessible names for icon-only controls. The local skill query found no React-specific matches for glassmorphism, so the existing Master/Addendum—not a generic catalog result—governs the visual treatment.

## Implementation decisions

- Keep palette, glass opacity/blur/saturation, borders, radii, shadows, spacing and motion values centralized in `frontend/tailwind.config.ts` and `frontend/src/styles/tokens.css`, not repeated in page components.
- Use Lucide icons consistently. Status chips always show text and an icon; controls retain visible keyboard focus, descriptive accessible names, and pointer cursors.
- Respect system color preference by default and persist an explicit light/dark choice. Reduce or remove motion for `prefers-reduced-motion`; provide solid surfaces when backdrop filters are unsupported or reduced transparency is requested.
- Keep the background static, avoid nested glass surfaces and blur animation, and use only gentle 200-300ms surface transitions and small hover lift. Maintain a mobile-first layout without fixed-nav content obstruction or horizontal overflow.

## Pre-delivery checklist (from `design-system/warrantyvault/MASTER.md`)

- [x] No emoji icons; use Lucide SVGs consistently.
- [x] Every clickable control has a pointer cursor and smooth hover transition.
- [x] Light-mode text contrast is at least 4.5:1; keyboard focus is visible.
- [x] Reduced-motion preference is respected.
- [x] Responsive layouts are checked at 375px, 768px, 1024px and 1440px.
- [x] No content is hidden behind fixed navigation and no mobile horizontal scrolling.
- [x] Addendum glass fallback and accessible text/icon status chips are present.
