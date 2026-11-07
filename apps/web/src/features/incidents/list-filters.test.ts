import { describe, expect, it } from 'vitest'
import { readFilters, toApiQuery, writeFilters } from './list-filters'

describe('incident list filters', () => {
  it('defaults to active incidents, most recently updated, page 1', () => {
    const filters = readFilters(new URLSearchParams())

    expect(filters).toEqual({
      status: 'active',
      priority: '',
      project: '',
      team: '',
      assignee: '',
      q: '',
      sort: 'updated',
      page: 1,
    })
    expect(writeFilters(filters).toString()).toBe('')
    expect(Object.fromEntries(toApiQuery(filters))).toEqual({
      status: 'OPEN,INVESTIGATING,BLOCKED',
      sort: 'updatedAt',
      order: 'desc',
      page: '1',
      pageSize: '20',
    })
  })

  it('maps URL filters to API parameters', () => {
    const filters = readFilters(
      new URLSearchParams(
        'status=RESOLVED&priority=CRITICAL&project=none&team=t1&assignee=me&q=+INC-4+&sort=priority&page=3',
      ),
    )

    expect(Object.fromEntries(toApiQuery(filters))).toEqual({
      status: 'RESOLVED',
      priority: 'CRITICAL',
      projectId: 'none',
      assignedTeamId: 't1',
      assigneeId: 'me',
      search: 'INC-4',
      sort: 'priority',
      order: 'desc',
      page: '3',
      pageSize: '20',
    })
  })

  it('sends no status for "all"', () => {
    const query = toApiQuery(readFilters(new URLSearchParams('status=all')))

    expect(query.has('status')).toBe(false)
  })

  it('ignores invalid values', () => {
    expect(
      readFilters(new URLSearchParams('status=DONE&priority=URGENT&sort=x&page=-2')),
    ).toMatchObject({ status: 'active', priority: '', sort: 'updated', page: 1 })
  })

  it('round-trips through the URL', () => {
    const params = 'status=all&priority=HIGH&assignee=none&sort=created&page=2'
    expect(writeFilters(readFilters(new URLSearchParams(params))).toString()).toBe(
      params,
    )
  })
})
