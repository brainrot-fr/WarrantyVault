# WarrantyVault

WarrantyVault keeps receipts, warranties, and purchase details together so you
always know what is covered and when protection ends.

## What you can do

- Scan a receipt or add a warranty manually.
- Keep purchase dates, warranty lengths, merchants, serial numbers, prices, and
  notes in one place.
- Get a clear expired, expiring soon, and active status for every warranty.
- Store JPG, PNG, and PDF receipts securely.
- Search and open warranties across your household.
- Share warranties with household members and manage invitations.
- Download claim packs with the warranty details and attached receipt.
- Choose email reminders for warranties that need attention.
- Use WarrantyVault on mobile or desktop, including light and dark themes.

## Getting started

1. Create an account or sign in.
2. Add your first warranty by scanning a receipt or entering the details
   manually.
3. Review the purchase date and warranty length, then save.
4. Open the warranty anytime to see coverage, update details, replace its
   receipt, or download a claim pack.

A Home household is created automatically when you add a warranty without
joining or creating one. Additional households can be created from the
Household page.

## Household sharing

Household owners can invite other people by email and manage pending invitations.
Members can add and update shared warranties. Owners can remove members, revoke
invites, or delete the household; members can leave a household when that option
is available.

## Privacy and storage

Receipts are attached to your household's warranties and access is controlled
with Supabase authentication and row-level security. Uploaded receipts accept
PDF, JPEG, and PNG files. Receipt OCR runs in the browser; images are processed
before you save the warranty.

## Running the app locally

For development prerequisites and service configuration, use
[docs/SETUP.md](./docs/SETUP.md).

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Support and documentation

- [Setup and deployment](./docs/SETUP.md)
- [Mobile app setup](./docs/MOBILE.md)
- [Reminder operations](./docs/OPERATIONS.md)
- [Feature parity record](./docs/PARITY.md)

For maintainers, run the application gate before submitting changes:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
