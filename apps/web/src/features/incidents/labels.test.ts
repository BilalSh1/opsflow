import { describe, expect, it } from 'vitest'
import type { IncidentActivity } from '../../types/incident'
import { describeActivity, incidentKey } from './labels'

const activity = (overrides: Partial<IncidentActivity>): IncidentActivity => ({
  id: 'a1',
  type: 'CREATED',
  actor: { userId: 'u1', firstName: 'Alice', lastName: 'Smith' },
  oldValue: null,
  newValue: null,
  createdAt: '2026-11-07T10:00:00.000Z',
  ...overrides,
})

describe('incident labels', () => {
  it('formats incident keys', () => {
    expect(incidentKey(12)).toBe('INC-12')
  })

  it.each([
    [{ type: 'CREATED' }, 'Alice Smith created the incident.'],
    [
      { type: 'STATUS_CHANGED', oldValue: 'OPEN', newValue: 'INVESTIGATING' },
      'Alice Smith changed status from Open to Investigating.',
    ],
    [
      { type: 'PRIORITY_CHANGED', oldValue: 'HIGH', newValue: 'CRITICAL' },
      'Alice Smith changed priority from High to Critical.',
    ],
    [
      { type: 'ASSIGNEE_CHANGED', oldValue: null, newValue: 'Bob Jones' },
      'Alice Smith assigned the incident to Bob Jones.',
    ],
    [
      { type: 'ASSIGNEE_CHANGED', oldValue: 'Bob Jones', newValue: null },
      'Alice Smith unassigned Bob Jones.',
    ],
    [
      { type: 'TEAM_CHANGED', oldValue: null, newValue: 'Backend' },
      'Alice Smith assigned the incident to the Backend team.',
    ],
    [
      { type: 'PROJECT_CHANGED', oldValue: 'Payments', newValue: null },
      'Alice Smith removed it from Payments.',
    ],
    [{ type: 'DESCRIPTION_CHANGED' }, 'Alice Smith updated the description.'],
  ] as const)('describes %o', (overrides, text) => {
    expect(describeActivity(activity(overrides))).toBe(text)
  })

  it('falls back when the actor is gone', () => {
    expect(describeActivity(activity({ actor: null }))).toBe(
      'Someone created the incident.',
    )
  })
})
