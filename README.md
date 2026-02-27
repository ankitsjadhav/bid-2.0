# Bid 2.0 MVP — Contractor ↔ Supplier Marketplace

This is a working MVP of a contractor ↔ supplier marketplace.

Contractors can write material requirements in plain text.
The system uses AI to structure the request and match it with relevant suppliers.

Suppliers receive only the RFQs that match their category and service area, submit bids, and contractors can compare and select a winner.

The focus of this project was clean architecture, secure role-based access, and a fully working end to end flow.

---

## Tech Stack

- Next.js (App Router) + TypeScript
- Firebase Authentication
- Firebase Firestore
- Groq API (Llama 3 70B, server-side only)
- Tailwind CSS + shadcn/ui
- Deployable on Vercel

---

## Setup Instructions

1. Clone the repository
2. Run:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root
4. Add the required environment variables
5. Start the app:
   ```bash
   npm run dev
   ```

The app runs at: `http://localhost:3000`

---

## Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""

GROQ_API_KEY=""
```

Make sure:

- Email/Password (and optionally Google) auth is enabled in Firebase
- Firestore database is created
- Security rules are configured

---

## Architecture Overview

### Data Model

`users/{uid}`

- `role` (contractor | supplier)
- `categories` (for suppliers)
- `serviceArea` (for suppliers)

`rfqs/{rfqId}`

- `contractorId`
- `status` (draft | sent | selected)
- `rawText`
- `structuredData`
- `matchingSupplierIds`

`bids/{bidId}`

- `rfqId`
- `supplierId`
- `pricing`
- `leadTime`
- `delivery`
- `notes`

---

## How Matching Works

When a contractor sends an RFQ:

1. AI structures the free-text input into strict JSON.
2. All supplier profiles are evaluated.
3. Category and city are matched (case-insensitive).
4. Matching supplier UIDs are saved inside `matchingSupplierIds`.

Suppliers only see RFQs where their UID exists in that array.

---

## Security

Security is enforced at multiple levels:

- **UI:** role based navigation
- **Middleware:** prevents unauthorized route access
- **Firestore Rules:** suppliers can only read RFQs where their UID is in `matchingSupplierIds`

Even if a user manually types a restricted route, access is blocked.

---

## AI Handling

AI responses are forced into strict JSON format.
If malformed JSON is returned, regex extraction and validation prevent crashes.

If parsing fails, the user receives a retry option instead of breaking the flow.

---

## Bonus Features

- AI Bid Recommendation (compares all bids and suggests the strongest option)

## Assumptions & Limitations

- Matching uses exact string comparison (case-insensitive)
- No geospatial radius logic (kept simple for MVP)
- File uploads are not included
- Optimized for structured text-based requests

---

## Demo Credentials

You can test the platform instantly using the following test accounts:

**Contractor:**

- Email: `contractor@demo.com`
- Password: `Demo123!`

**Supplier 1:**

- Email: `supplier1@demo.com`
- Password: `Demo123!`

**Supplier 2:**

- Email: `supplier2@demo.com`
- Password: `Demo123!`

---

## Demo Flow

1. Login as Contractor
2. Create RFQ → AI structures it
3. Send to suppliers
4. Login as matching Supplier → submit bid
5. Login back as Contractor → compare bids
6. Generate AI recommendation
7. Select winner

End to end flow works fully.
