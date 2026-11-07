import { IncidentStatus } from '../generated/prisma/client';
import {
  allowedTransitions,
  canTransition,
  lifecycleDates,
} from './incident-status';

const { OPEN, INVESTIGATING, BLOCKED, RESOLVED, CLOSED } = IncidentStatus;

describe('incident status workflow', () => {
  it.each([
    [OPEN, INVESTIGATING],
    [OPEN, BLOCKED],
    [OPEN, RESOLVED],
    [INVESTIGATING, BLOCKED],
    [BLOCKED, INVESTIGATING],
    [INVESTIGATING, RESOLVED],
    [RESOLVED, CLOSED],
    [RESOLVED, INVESTIGATING],
    [CLOSED, OPEN],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [OPEN, CLOSED],
    [INVESTIGATING, CLOSED],
    [BLOCKED, CLOSED],
    [CLOSED, RESOLVED],
    [CLOSED, INVESTIGATING],
    [OPEN, OPEN],
  ])('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('only lets closed incidents be reopened', () => {
    expect(allowedTransitions(CLOSED)).toEqual([OPEN]);
  });

  describe('lifecycleDates', () => {
    const now = new Date('2026-11-07T12:00:00.000Z');
    const earlier = new Date('2026-11-07T10:00:00.000Z');

    it('sets resolvedAt when resolving', () => {
      expect(
        lifecycleDates(RESOLVED, { resolvedAt: null, closedAt: null }, now),
      ).toEqual({ resolvedAt: now, closedAt: null });
    });

    it('keeps the first resolvedAt and sets closedAt when closing', () => {
      expect(
        lifecycleDates(CLOSED, { resolvedAt: earlier, closedAt: null }, now),
      ).toEqual({ resolvedAt: earlier, closedAt: now });
    });

    it('clears both dates when reopening', () => {
      expect(
        lifecycleDates(OPEN, { resolvedAt: earlier, closedAt: earlier }, now),
      ).toEqual({ resolvedAt: null, closedAt: null });
      expect(
        lifecycleDates(
          INVESTIGATING,
          { resolvedAt: earlier, closedAt: null },
          now,
        ),
      ).toEqual({ resolvedAt: null, closedAt: null });
    });
  });
});
