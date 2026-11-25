# Security Specification — Plano de Gala (Firestore + Control Panel)

## 1. Access Model & Data Invariants
1. **Default-Deny Catch-All**: Any path outside `/tableReservations/{tableId}` and `/appConfig/controlPanel` is strictly denied.
2. **Strict Table Path & Cross-Field Integrity**: Every table document ID `{tableId}` must match `^toldo-(1|2|3|5|6|7|8)-mesa-([1-9]|1[0-5])$` and equal `'toldo-' + string(data.toldoId) + '-mesa-' + string(data.tableNumber)`.
3. **Exact Key Allowlists**: `/tableReservations/{tableId}` permits only its exact 10 fields; `/appConfig/controlPanel` permits only its exact 6 fields (`passwordHash`, `passwordSalt`, `reservationsLocked`, `editRequiresAdmin`, `eventNotice`, `updatedAt`).
4. **Control Panel Document Hardening**: Only `configId == 'controlPanel'` is permitted; `list` and `delete` on `/appConfig` are permanently denied; `passwordHash` must be a 64-char lowercase hex digest and `passwordSalt` a 32-char lowercase hex string; `eventNotice` is capped at 180 characters.
5. **Temporal Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time`.
6. **Zero Plaintext Passwords & Zero PII**: Passwords are never hardcoded or stored in plaintext; PBKDF2-SHA256 derived hashes + random salts are stored in `/appConfig/controlPanel` and unlocked admin sessions live strictly in React memory (never `localStorage`/`sessionStorage`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. Invalid Toldo 4 dance floor table (`toldo-4-mesa-1`) -> `PERMISSION_DENIED`.
2. Path ID poisoning (150-char junk ID) -> `PERMISSION_DENIED`.
3. Cross-field mismatch (`toldo-1-mesa-1` with `toldoId: 2`) -> `PERMISSION_DENIED`.
4. Shadow field injection (`isAdmin: true`) on `/tableReservations` -> `PERMISSION_DENIED`.
5. Seat count out of range (`guestsCount: 11` or `0`) -> `PERMISSION_DENIED`.
6. Oversized `guestName` (> 120 chars) or `notes` (> 240 chars) -> `PERMISSION_DENIED`.
7. Client-forged timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`.
8. Immutable field update (`tableNumber` or `createdAt`) -> `PERMISSION_DENIED`.
9. Arbitrary document creation in `/appConfig/otherDoc` -> `PERMISSION_DENIED`.
10. Invalid `passwordHash` format (plaintext string instead of 64-char hex) -> `PERMISSION_DENIED`.
11. Oversized `eventNotice` (> 180 chars) or shadow field on `/appConfig/controlPanel` -> `PERMISSION_DENIED`.
12. Deleting `/appConfig/controlPanel` or listing `/appConfig` -> `PERMISSION_DENIED`.
