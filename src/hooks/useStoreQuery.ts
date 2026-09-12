import { useEffect, useState } from 'react'
import { storeCall } from '../../lib/store'

export function useStoreQuery<T>(name: string, input: unknown = {}, enabled = true) {
  const json = JSON.stringify(input)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: '', data: null, error: null })
  const key = `${name}:${json}:${revision}`
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void storeCall<T>(name, JSON.parse(json)).then(
      (data) => { if (!cancelled) setState({ key, data, error: null }) },
      (error: unknown) => { if (!cancelled) setState({ key, data: null, error: error instanceof Error ? error.message : 'The Store could not be reached.' }) },
    )
    return () => { cancelled = true }
  }, [name, json, revision, key, enabled])
  return { data: enabled && state.key === key ? state.data : null, error: enabled && state.key === key ? state.error : null, loading: enabled && state.key !== key, reload: () => setRevision((value) => value + 1) }
}
