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
    name: '5. Shared table overbooking above 10 seats (6 + 5 = 11)',
    path: '/tableReservations/toldo-1-mesa-3',
    operation: 'update',
    payload: {
      guestsCount: 11,
      reservations: [
        { guestName: 'Familia A', guestsCount: 6, tag: 'familia', notes: '' },
        { guestName: 'Familia B', guestsCount: 5, tag: 'familia', notes: '' },
      ],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Mismatched top-level guestsCount vs sum of reservations',
    path: '/tableReservations/toldo-1-mesa-4',
    operation: 'update',
    payload: {
      guestsCount: 8,
      reservations: [
        { guestName: 'Familia A', guestsCount: 5, tag: 'estandar', notes: '' },
        { guestName: 'Familia B', guestsCount: 4, tag: 'estandar', notes: '' },
      ],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Array overflow (> 10 entries) or shadow field inside reservations item',
    path: '/tableReservations/toldo-1-mesa-5',
    operation: 'update',
    payload: {
      guestsCount: 10,
      reservations: [
        {
          guestName: 'Familia A',
          guestsCount: 10,
          tag: 'estandar',
          notes: '',
          injected: true,
        },
      ],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Oversized guestName (> 200 chars top-level or > 120 per booking)',
    path: '/tableReservations/toldo-1-mesa-6',
    operation: 'create',
    payload: { guestName: 'X'.repeat(201) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Client-forged timestamp or immutable tableNumber modification',
    path: '/tableReservations/toldo-1-mesa-9',
    operation: 'update',
    payload: { tableNumber: 15, createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Unauthorized configId in /appConfig',
    path: '/appConfig/unauthorizedDoc',
    operation: 'create',
    payload: { reservationsLocked: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Plaintext passwordHash or oversized eventNotice in /appConfig/controlPanel',
    path: '/appConfig/controlPanel',
    operation: 'update',
    payload: { passwordHash: '123456', eventNotice: 'E'.repeat(181) },
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
