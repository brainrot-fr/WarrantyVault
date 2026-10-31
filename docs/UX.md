# WarrantyVault interface guide

## Vocabulary

| Previous term | WarrantyVault term |
| --- | --- |
| Add item / Add an item | Add warranty |
| Drawer / Needs attention | Expiring soon |
| Capture / Review / Coverage | Receipt / Product / Warranty |
| Claim pack | Claim PDF |
| Household | Family |
| OCR / scan wording | Take a photo of your receipt and we'll fill in the details |

## Main screens

- **Warranties**: search, status filters, soonest-expiring rows, and a collapsed Ended section.
- **Family**: sharing controls, members, invitations, and family creation.
- **Settings**: profile, reminders, appearance, account deletion, and sign out.
- **Add warranty**: three steps for Receipt, Product, and Warranty.
- **Warranty detail**: coverage summary, receipt/Claim PDF actions, details, edit, and delete.
- **Invitations**: pending invitations for the signed-in user's email address.
- **Authentication**: sign in/up, password reset, recovery, and invitation-aware confirmation.
- **Design showcase**: `/design`, development-only component samples and responsive torture data.

## Visual and sizing rules

- UI text and labels belong in `src/lib/copy.ts`.
- Use `rem` for text, spacing, control dimensions, rail width, page padding, and radii.
- Text-bearing controls use `min-height` rather than a fixed height and must allow wrapping.
- Buttons, inputs, selects, text areas, and switches share `--control-h`.
- Use the page padding token, not independent app and page padding.
- Use `dvh` for viewport-height calculations and allow text layouts to shrink in flex/grid children.
- Wrap long names, serial numbers, merchants, and email addresses.
- Preserve visible keyboard focus, semantic labels, linked inline errors, and touch targets at least as tall as `--control-h`.

## Status and date language

- "All your warranties are active."
- "1 warranty ends within 30 days."
- "2 warranties end within 30 days."
- "Active", "Ends in 12 days", and "Ended" for status pills.
- Use `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })` for visible dates.
