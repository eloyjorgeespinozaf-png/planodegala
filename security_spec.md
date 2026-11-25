# Security Specification — Plano de Gala (Firestore Direct Shared Access)

## 1. Access Model & Data Invariants
The application provides direct, login-free collaborative access to the shared event seating plan (`/tableReservations/{tableId}`) per explicit user instruction, with zero PII stored in Firestore. Every operation is strictly guarded by schema validation, path hardening, immutable field locks, and server timestamp integrity:

1. **Default-Deny Catch-All**: Any path outside `/tableReservations/{tableId}` is strictly denied (`allow read, write: if false;`).
2. **Strict Path & Cross-Field Integrity**: Every document ID `{tableId}` must match `^toldo-(1|2|3|5|6|7|8)-mesa-([1-9]|1[0-5])$` (Toldo 4 is the dance floor and cannot hold tables) and MUST equal `'toldo-' + string(data.toldoId) + '-mesa-' + string(data.tableNumber)`.
3. **Exact Key Allowlist (Anti-Shadow Fields)**: Every document MUST contain ONLY the exact 10 schema fields (`tableId`, `toldoId`, `tableNumber`, `guestName`, `guestsCount`, `tag`, `notes`, `visibility`, `createdAt`, `updatedAt`).
4. **Volumetric & Type Bounds**: `guestName` (1..120 chars), `notes` (0..240 chars), `guestsCount` (int 1..10), `toldoId` (int in `[1,2,3,5,6,7,8]`), `tableNumber` (int 1..15), `tag` (`estandar | vip | familia | honor`), `visibility == 'shared'`.
5. **Action-Based Update & Immutability**: Updates may ONLY touch `['guestName', 'guestsCount', 'tag', 'notes', 'updatedAt']` while keeping `tableId`, `toldoId`, `tableNumber`, `visibility`, and `createdAt` immutable.
6. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
7. **Secure List Queries**: `allow list` explicitly checks `existing().visibility == 'shared'` without `get()` or `exists()`.
8. **Zero PII**: No emails, phone numbers, addresses, or user credentials are stored in `/tableReservations`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Invalid Toldo 4 Dance Floor Table (`toldo-4-mesa-1`)** — Must return `PERMISSION_DENIED`.
2. **Oversized Path ID Poisoning (150-char doc ID)** — Must return `PERMISSION_DENIED`.
3. **Cross-Field Mismatch (`tableId: toldo-1-mesa-1` with `toldoId: 2`)** — Must return `PERMISSION_DENIED`.
4. **Shadow/Ghost Field Injection (`isAdmin: true`) on Create** — Must return `PERMISSION_DENIED`.
5. **Seat Count Out of Bounds (`guestsCount: 11` or `0`)** — Must return `PERMISSION_DENIED`.
6. **Non-Integer Seat Count (`guestsCount: "5"` or `5.5`)** — Must return `PERMISSION_DENIED`.
7. **Oversized `guestName` (> 120 chars) / Empty `guestName`** — Must return `PERMISSION_DENIED`.
8. **Oversized `notes` (> 240 chars)** — Must return `PERMISSION_DENIED`.
9. **Invalid Protocol Tag (`tag: "supervip"`)** — Must return `PERMISSION_DENIED`.
10. **Client-Forged Timestamp (`createdAt` != `request.time`)** — Must return `PERMISSION_DENIED`.
11. **Immutable Field Tampering (`createdAt` or `tableNumber` changed on Update)** — Must return `PERMISSION_DENIED`.
12. **Unauthorized Collection Access (`/secret/doc1` or `/admins/any`)** — Must return `PERMISSION_DENIED`.
