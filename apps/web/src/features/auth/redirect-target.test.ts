import { describe, expect, it } from 'vitest'
import { redirectTarget } from './redirect-target'

describe('redirectTarget', () => {
  it('returns the path the user came from', () => {
    expect(redirectTarget({ from: '/incidents/42' })).toBe('/incidents/42')
  })

  it.each([
    undefined,
    null,
    'not-an-object',
    {},
    { from: 42 },
    { from: 'https://evil.example' },
    { from: '//evil.example' },
  ])('falls back to "/" for %p', (state) => {
    expect(redirectTarget(state)).toBe('/')
  })
})
