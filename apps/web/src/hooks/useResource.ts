import { useCallback, useEffect, useEffectEvent, useState } from 'react'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown }

export interface Resource<T> {
  state: ResourceState<T>
  reload: () => void
  // Replaces the loaded data locally, e.g. after a successful mutation.
  update: (updater: (current: T) => T) => void
}

// Loads `load()` whenever `key` changes. Results are tagged with the key and
// attempt they belong to, so a stale result reads as "loading" without
// resetting state inside the effect.
export function useResource<T>(key: string, load: () => Promise<T>): Resource<T> {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{
    key: string
    state: Exclude<ResourceState<T>, { status: 'loading' }>
  } | null>(null)

  const currentKey = `${key}:${attempt}`
  const runLoad = useEffectEvent(load)

  useEffect(() => {
    let active = true

    runLoad().then(
      (data) => {
        if (active) {
          setLoaded({ key: currentKey, state: { status: 'ready', data } })
        }
      },
      (error: unknown) => {
        if (active) {
          setLoaded({ key: currentKey, state: { status: 'error', error } })
        }
      },
    )

    return () => {
      active = false
    }
  }, [currentKey])

  const reload = useCallback(() => setAttempt((current) => current + 1), [])

  const update = useCallback(
    (updater: (current: T) => T) =>
      setLoaded((current) =>
        current?.key === currentKey && current.state.status === 'ready'
          ? {
              key: currentKey,
              state: { status: 'ready', data: updater(current.state.data) },
            }
          : current,
      ),
    [currentKey],
  )

  const state: ResourceState<T> =
    loaded?.key === currentKey ? loaded.state : { status: 'loading' }

  return { state, reload, update }
}
