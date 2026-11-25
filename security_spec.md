# Security Specification — Croquis de Gala (Firestore + Mesas Compartidas + Control Panel)

## 1. Access Model & Data Invariants
1. **Default-Deny Catch-All**: Any path outside `/tableReservations/{tableId}` and `/appConfig/controlPanel` is strictly denied.
2. **Strict Table Path & Cross-Field Integrity**: Every table document ID `{tableId}` must match `^toldo-(1|2|3|5|6|7|8)-mesa-([1-9]|1[0-5])$` and equal `'toldo-' + string(data.toldoId) + '-mesa-' + string(data.tableNumber)`.
3. **Exact Key Allowlists**: `/tableReservations/{tableId}` permits only its exact 10 required fields plus the optional bounded `reservations` list; `/appConfig/controlPanel` permits only its exact 6 fields.
4. **Total Array Guarding & 10-Seat Cap Invariant**: When `reservations` is present on `/tableReservations/{tableId}`, it must be a `list` of `1..10` maps, every single slot `0..9` is strictly validated (`hasAll`/`hasOnly` keys `['guestName', 'guestsCount', 'tag', 'notes']`, bounded string lengths, valid tag enum, integer `guestsCount` in `1..10`), and the exact sum of `guestsCount` across all entries must equal top-level `data.guestsCount` (which is itself `1..10`), making overbooking mathematically impossible even if the client is bypassed.
5. **Control Panel Document Hardening**: Only `configId == 'controlPanel'` is permitted; `list` and `delete` on `/appConfig` are permanently denied; `passwordHash` must be a 64-char lowercase hex digest and `passwordSalt` a 32-char lowercase hex string; `eventNotice` is capped at 180 characters.
6. **Temporal Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. Invalid Toldo 4 dance floor table (`toldo-4-mesa-1`) -> `PERMISSION_DENIED`.
2. Path ID poisoning (150-char junk ID) -> `PERMISSION_DENIED`.
3. Cross-field mismatch (`toldo-1-mesa-1` with `toldoId: 2`) -> `PERMISSION_DENIED`.
4. Shadow field injection (`isAdmin: true`) on `/tableReservations` -> `PERMISSION_DENIED`.
5. Seat count overbooking across shared reservations (e.g., `6 + 5 = 11` or `guestsCount: 11`) -> `PERMISSION_DENIED`.
6. Mismatched seat sum (`guestsCount: 8` while `reservations` sum to `9`) -> `PERMISSION_DENIED`.
7. Array overflow or ghost field inside `reservations` (`11` items or `{ isVipOverride: true }`) -> `PERMISSION_DENIED`.
8. Oversized `guestName` (> 200 chars top-level or > 120 chars per booking) or `notes` (> 240 chars) -> `PERMISSION_DENIED`.
9. Client-forged timestamp (`createdAt` != `request.time`) or immutable `tableNumber` update -> `PERMISSION_DENIED`.
10. Unauthorized document creation in `/appConfig/otherDoc` -> `PERMISSION_DENIED`.
11. Plaintext `passwordHash` or oversized `eventNotice` (> 180 chars) on `/appConfig/controlPanel` -> `PERMISSION_DENIED`.
12. Deleting `/appConfig/controlPanel` or listing `/appConfig` -> `PERMISSION_DENIED`.
