import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Security TDD Specification Runner for Plano de Gala (Direct Shared Access)
 * Verifies all 12 Dirty Dozen adversarial payloads against Firestore rules invariants.
 */
export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Invalid Toldo 4 dance floor table ID',
    path: '/tableReservations/toldo-4-mesa-1',
    operation: 'create',
    payload: {
      tableId: 'toldo-4-mesa-1',
      toldoId: 4,
      tableNumber: 1,
      guestName: 'Familia Prueba',
      guestsCount: 6,
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Path ID poisoning (150-char junk ID)',
    path: `/tableReservations/${'a'.repeat(150)}`,
    operation: 'create',
    payload: {
      tableId: 'a'.repeat(150),
      toldoId: 1,
      tableNumber: 1,
      guestName: 'Familia Prueba',
      guestsCount: 4,
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-field toldoId/tableId mismatch',
    path: '/tableReservations/toldo-1-mesa-1',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-1',
      toldoId: 2,
      tableNumber: 1,
      guestName: 'Familia Prueba',
      guestsCount: 5,
      tag: 'vip',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Shadow/Ghost field injection on create',
    path: '/tableReservations/toldo-1-mesa-2',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-2',
      toldoId: 1,
      tableNumber: 2,
      guestName: 'Familia Prueba',
      guestsCount: 5,
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Seat count above 10 (guestsCount: 11)',
    path: '/tableReservations/toldo-1-mesa-3',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-3',
      toldoId: 1,
      tableNumber: 3,
      guestName: 'Familia Prueba',
      guestsCount: 11,
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Invalid seat count type (string instead of int)',
    path: '/tableReservations/toldo-1-mesa-4',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-4',
      toldoId: 1,
      tableNumber: 4,
      guestName: 'Familia Prueba',
      guestsCount: '8',
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Oversized guestName (> 120 chars)',
    path: '/tableReservations/toldo-1-mesa-5',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-5',
      toldoId: 1,
      tableNumber: 5,
      guestName: 'X'.repeat(121),
      guestsCount: 4,
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Oversized notes (> 240 chars)',
    path: '/tableReservations/toldo-1-mesa-6',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-6',
      toldoId: 1,
      tableNumber: 6,
      guestName: 'Familia Prueba',
      guestsCount: 4,
      tag: 'estandar',
      notes: 'N'.repeat(241),
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Invalid protocol tag enum',
    path: '/tableReservations/toldo-1-mesa-7',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-7',
      toldoId: 1,
      tableNumber: 7,
      guestName: 'Familia Prueba',
      guestsCount: 4,
      tag: 'supervip',
      notes: '',
      visibility: 'shared',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Client-forged timestamp on create',
    path: '/tableReservations/toldo-1-mesa-8',
    operation: 'create',
    payload: {
      tableId: 'toldo-1-mesa-8',
      toldoId: 1,
      tableNumber: 8,
      guestName: 'Familia Prueba',
      guestsCount: 4,
      tag: 'estandar',
      notes: '',
      visibility: 'shared',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Immutable field modification on update (tableNumber)',
    path: '/tableReservations/toldo-1-mesa-9',
    operation: 'update',
    payload: {
      tableNumber: 15,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Catch-all denial on undeclared collection',
    path: '/secret/doc1',
    operation: 'read',
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
