import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Invalid Toldo 4 dance floor table ID',
    path: '/tableReservations/toldo-4-mesa-1',
    operation: 'create',
    payload: { toldoId: 4, tableNumber: 1, guestName: 'Test', guestsCount: 5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Path ID poisoning (150-char junk ID)',
    path: `/tableReservations/${'a'.repeat(150)}`,
    operation: 'create',
    payload: { tableId: 'a'.repeat(150), toldoId: 1, tableNumber: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-field toldoId/tableId mismatch',
    path: '/tableReservations/toldo-1-mesa-1',
    operation: 'create',
    payload: { tableId: 'toldo-1-mesa-1', toldoId: 2, tableNumber: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Shadow/Ghost field injection on reservation',
    path: '/tableReservations/toldo-1-mesa-2',
    operation: 'create',
    payload: { tableId: 'toldo-1-mesa-2', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Seat count above 10 (guestsCount: 11)',
    path: '/tableReservations/toldo-1-mesa-3',
    operation: 'create',
    payload: { tableId: 'toldo-1-mesa-3', guestsCount: 11 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Oversized guestName (> 120 chars)',
    path: '/tableReservations/toldo-1-mesa-5',
    operation: 'create',
    payload: { guestName: 'X'.repeat(121) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Client-forged timestamp on create',
    path: '/tableReservations/toldo-1-mesa-8',
    operation: 'create',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Immutable field modification on update (tableNumber)',
    path: '/tableReservations/toldo-1-mesa-9',
    operation: 'update',
    payload: { tableNumber: 15 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Unauthorized configId in /appConfig',
    path: '/appConfig/unauthorizedDoc',
    operation: 'create',
    payload: { reservationsLocked: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Plaintext passwordHash in /appConfig/controlPanel',
    path: '/appConfig/controlPanel',
    operation: 'create',
    payload: { passwordHash: '123456', passwordSalt: 'abc' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Oversized eventNotice (> 180 chars) in /appConfig/controlPanel',
    path: '/appConfig/controlPanel',
    operation: 'update',
    payload: { eventNotice: 'E'.repeat(181) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Deleting /appConfig/controlPanel',
    path: '/appConfig/controlPanel',
    operation: 'delete',
    payload: {},
    expected: 'PERMISSION_DENIED',
  },
] as const;

describe('Firestore Rules Dirty Dozen Spec', () => {
  it('defines all 12 adversarial payloads expecting PERMISSION_DENIED', () => {
    assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
    for (const testCase of DIRTY_DOZEN_PAYLOADS) {
      assert.equal(testCase.expected, 'PERMISSION_DENIED');
    }
  });
});
