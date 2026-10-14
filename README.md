# CharityHub

Validated cases for people in need, a trusted chain of donors, zakat and
seasonal giving (Eid, Ramadan) — in one place, shared between independent
"hubs" so nobody is funded twice without knowing.

## Stack

- Next.js (App Router, TypeScript) + Tailwind CSS
- PostgreSQL + Prisma
- Email/password accounts (bcrypt + JWT session cookie via `jose`)

## Local setup

1. **Database.** `docker compose up -d`, or point `DATABASE_URL` at any Postgres.
2. **Environment.**
   ```bash
   cp .env.example .env   # set JWT_SECRET to a long random string
   ```
3. **Install & migrate.**
   ```bash
   npm install
   npm run db:migrate
   ```
4. **Run.** `npm run dev`, open http://localhost:3000 and create an account.

## How it works

CharityHub is for supporting validated cases of people in need, built on a chain of
trust (`src/lib/donation-calc.ts` holds the rules, `tests/donation-calc.test.ts`
and `tests/donations.test.ts` cover them).

- **Accounts** — anyone can sign up (`/signup`, email + password, a 7-day
  JWT session cookie) and run their own hubs.
- **Hubs** (`DonationHub`) — one "source" each: a person or team running
  their own giving. *Individual* hubs are seen only by the owner and their
  team (`DonationHubMember`, added by the email of an existing account);
  *public* hubs are visible to every signed-in user, but only the team can
  change them.
- **Trust layers** (`Donor.layer`) — the hub team is layer 1; family or
  close friends the team brings in are layer 2; family/close friends of a
  layer-n donor are layer n+1 (capped at 6). Anyone below the team must be
  *family* or *close friend*. A contact list can be imported (Donors →
  "Import a contact list", template at `/api/donors/import/template`) under
  one inviter; rows with another relation or a mobile already in the hub are
  skipped.
- **Validity grade** — a case takes the layer of whoever knows it
  first-hand: A 100% (team), B 80%, C 60%, D 40%, E 20% (layer 5+). Home
  visit / documents checked are shown alongside. A case can't be activated
  or receive money until someone validates it; `nextReviewDate` lists it on
  the overview for re-checking.
- **Shared registry, no double funding** — every new or edited case is
  checked against *every* hub by national ID and normalized mobile. A match
  returns 409 with the other hub's name, status, active sponsors and the last
  90 days' giving (never the other hub's details unless you can see that hub);
  "Save anyway" proceeds. Case lists flag cases also registered elsewhere.
- **Visibility** — `CHAIN` cases are visible to every donor of the hub;
  `PRIVATE` cases only to the donors picked (plus the validator). Each donor
  gets a signed 90-day read-only link (`/give/<token>`, `src/lib/donor-link.ts`)
  showing the cases they may see, with names shortened and no contact details.
- **Funding** — one-time goal (auto-marked *Funded* when reached) or
  monthly/quarterly need. **Sponsorships** are a donor's standing
  monthly/quarterly commitment; each period is recorded once (`Donation`
  unique on sponsorship + `periodKey` like `2026-10` / `2026-Q4`). The
  Periodic tab shows what's due this period and what's overdue, with a
  WhatsApp reminder link.
- **Islamic rules** — cases carry one of the eight zakat categories
  (At-Tawbah 9:60) or none (sadaqah only). Zakat al-mal needs a category;
  zakat al-fitr, kaffarah and fidyah need *fuqara* or *masakin*.
  **Occasions** (Zakat al-Fitr, Eid al-Adha udhiyah meat, Ramadan, aqiqah,
  kaffarah, fidyah, winter, back to school, Ashura/Arafah) list their timing
  and rules and track what each case receives and whether it was delivered.
- **Zakat calculator** (`src/lib/zakat-calc.ts`) — 2.5% (2.577% on a
  Gregorian year) of net zakatable wealth once it passes the nisab (85 g gold
  or 595 g silver) for a full hawl; karat conversion, worn-jewellery toggle
  (majority vs Hanafi), debts due now deducted; plus zakat al-fitr, crops
  (10% / 5% / 7.5%) and udhiyah shares/meat thirds.

## Testing

```bash
npm test
```

Tests run against the database in `.env.test` (create it once:
`createdb -O charityhub charityhub_test`); the global setup applies
migrations and starts `next dev` on `TEST_PORT`. `tests/donation-calc.test.ts`
covers the pure rules (layers, grades, periods, zakat); `tests/donations.test.ts`
drives the API end to end.

## Deploying

Any Next.js host with Postgres (e.g. Vercel + Neon): set `DATABASE_URL`,
`DIRECT_URL` and `JWT_SECRET`, and run `npm run db:migrate:deploy` on release.
