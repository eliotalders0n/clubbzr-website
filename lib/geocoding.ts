import { httpsCallable } from 'firebase/functions'

import { functions } from './config'

export interface GeocodingSearchResult {
  id: string
  name: string
  displayName: string
  address: string
  city: string
  latitude: number
  longitude: number
}

interface SearchLocationsInput {
  query: string
}

interface SearchLocationsResponse {
  results: GeocodingSearchResult[]
}

const searchLocationsFn = httpsCallable<SearchLocationsInput, SearchLocationsResponse>(
  functions,
  'adminSearchLocations',
  { timeout: 15000 }
)

export async function searchZambianLocations(query: string, signal?: AbortSignal): Promise<GeocodingSearchResult[]> {
  if (signal?.aborted) throw new DOMException('Location search cancelled.', 'AbortError')

  const request = searchLocationsFn({ query: query.trim() })
    .then((result) => result.data.results)

  if (!signal) return request

  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Location search cancelled.', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    request.then((results) => {
      signal.removeEventListener('abort', abort)
      resolve(results)
    }, (error) => {
      signal.removeEventListener('abort', abort)
      reject(error)
    })
  })
}
