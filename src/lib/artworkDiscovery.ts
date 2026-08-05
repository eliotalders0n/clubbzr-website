import type { ArtMedium, Artist, Artwork, Exhibition, PortfolioItem } from '../../lib/schema'

export const DISCOVERY_MEDIUMS: ArtMedium[] = [
  'painting',
  'illustration',
  'photography',
  'digital',
  'mixed_media',
  'ceramics',
  'sculpture',
  'video',
]

export const DISCOVERY_SHUFFLE_SEED = 'club-bzr-artwork-discovery'

export type ArtworkSource = 'upload' | 'portfolio' | 'exhibition'

export type ArtistCredit = {
  name: string
  artistId?: string
  avatarUrl?: string
  externalUrl?: string
  isExternal: boolean
}

export type DiscoveryArtwork = {
  id: string
  source: ArtworkSource
  sourceId: string
  parentId?: string
  title: string
  description?: string
  medium: ArtMedium
  imageUrl: string
  mediaUrls: string[]
  genres: string[]
  tags: string[]
  location?: string
  dateKey?: string
  year?: number
  createdAtMs: number
  detailHref: string
  credit: ArtistCredit
}

export function formatMedium(medium: string): string {
  return medium.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getTimestampMs(value: unknown): number {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : 0
}

export function getDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

export function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function stableScore(value: string, seed: string): number {
  let hash = 2166136261
  const input = `${seed}:${value}`
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getPortfolioImage(item: PortfolioItem): string {
  return item.thumbnailUrl || item.mediaUrls?.[0] || item.externalUrl || ''
}

export function getExhibitionLocation(exhibition: Exhibition): string | undefined {
  if (!exhibition.location) return undefined
  return [exhibition.location.name, exhibition.location.city].filter(Boolean).join(', ')
}

export function getArtworkEngagementKey(artwork: DiscoveryArtwork): string {
  if (artwork.source === 'exhibition' && artwork.parentId) return `${artwork.parentId}:${artwork.sourceId}`
  return artwork.id
}

export function getArtworkProfileHref(credit: ArtistCredit): string | undefined {
  return !credit.isExternal && credit.artistId ? `/artists/${credit.artistId}` : undefined
}

export function getArtworkDetailHref(id: string): string {
  return `/artworks/${encodeURIComponent(id)}`
}

function buildCredit({
  artistName,
  artistPhotoURL,
  artistExternalUrl,
  artist,
}: {
  artistName?: string
  artistPhotoURL?: string
  artistExternalUrl?: string
  artist?: Artist
}): ArtistCredit {
  const internalArtistId = artist ? artist.id : undefined
  const name = artist?.artistName || artist?.name || artistName || 'Unknown artist'

  return {
    name,
    ...(internalArtistId ? { artistId: internalArtistId } : {}),
    ...(artist?.photoURL || artistPhotoURL ? { avatarUrl: artist?.photoURL || artistPhotoURL } : {}),
    ...(artistExternalUrl ? { externalUrl: artistExternalUrl } : {}),
    isExternal: !internalArtistId,
  }
}

function buildSearchableTags(...groups: Array<string[] | undefined>): string[] {
  return groups.flatMap((group) => group || []).filter(Boolean)
}

export function buildDiscoveryArtworks({
  artists,
  uploadedArtworks,
  exhibitions,
}: {
  artists: Artist[]
  uploadedArtworks: Artwork[]
  exhibitions: Exhibition[]
}): DiscoveryArtwork[] {
  const artistsById = new Map(artists.map((artist) => [artist.id, artist]))
  const artistsByName = new Map<string, Artist>()

  artists.forEach((artist) => {
    ;[artist.artistName, artist.name]
      .filter((name): name is string => Boolean(name?.trim()))
      .forEach((name) => artistsByName.set(name.trim().toLowerCase(), artist))
  })

  const resolveArtist = (artistId?: string, artistName?: string) =>
    (artistId ? artistsById.get(artistId) : undefined) ||
    (artistName ? artistsByName.get(artistName.trim().toLowerCase()) : undefined)

  const uploaded = uploadedArtworks
    .filter((artwork) => artwork.visibility !== 'unlisted')
    .map((artwork): DiscoveryArtwork => {
      const artist = resolveArtist(artwork.artistId, artwork.artistName)
      const artworkDate = getDate(artwork.artworkDate)
      const id = `upload-${artwork.id}`
      const imageUrl = artwork.thumbnailUrl || artwork.imageUrl

      return {
        id,
        source: 'upload',
        sourceId: artwork.id,
        title: artwork.title,
        ...(artwork.description ? { description: artwork.description } : {}),
        medium: artwork.medium,
        imageUrl,
        mediaUrls: artwork.mediaUrls?.length ? artwork.mediaUrls : [imageUrl],
        genres: artwork.genres || [],
        tags: artwork.tags || [],
        ...(artwork.location ? { location: artwork.location } : {}),
        ...(artworkDate ? { dateKey: toDateKey(artworkDate) } : {}),
        ...(artwork.year ? { year: artwork.year } : {}),
        createdAtMs: getTimestampMs(artwork.createdAt),
        detailHref: getArtworkDetailHref(id),
        credit: buildCredit({
          artistName: artwork.artistName,
          artistPhotoURL: artwork.artistPhotoURL,
          artistExternalUrl: artwork.artistExternalUrl,
          artist,
        }),
      }
    })

  const portfolio = artists.flatMap((artist) =>
    (artist.portfolio || [])
      .map((item): DiscoveryArtwork | null => {
        const imageUrl = getPortfolioImage(item)
        if (!imageUrl) return null
        const id = `portfolio-${artist.id}-${item.id}`

        return {
          id,
          source: 'portfolio',
          sourceId: item.id,
          parentId: artist.id,
          title: item.title,
          ...(item.description ? { description: item.description } : {}),
          medium: item.medium,
          imageUrl,
          mediaUrls: item.mediaUrls?.length ? item.mediaUrls : [imageUrl],
          genres: artist.styles || [],
          tags: buildSearchableTags(artist.styles, artist.interests),
          ...(item.year ? { year: item.year } : {}),
          createdAtMs: getTimestampMs(artist.createdAt),
          detailHref: getArtworkDetailHref(id),
          credit: buildCredit({
            artistName: artist.artistName || artist.name,
            artistPhotoURL: artist.photoURL,
            artist,
          }),
        }
      })
      .filter((item): item is DiscoveryArtwork => Boolean(item))
  )

  const exhibitionWorks = exhibitions.flatMap((exhibition) =>
    (exhibition.artworks || [])
      .map((item): DiscoveryArtwork | null => {
        const imageUrl = item.thumbnailUrl || item.mediaUrls?.[0]
        if (!imageUrl) return null

        const artist = resolveArtist(item.artistId, item.artistName)
        const exhibitionDate = getDate(exhibition.startDate)
        const id = `exhibition-${exhibition.id}-${item.id}`
        const location = getExhibitionLocation(exhibition)

        return {
          id,
          source: 'exhibition',
          sourceId: item.id,
          parentId: exhibition.id,
          title: item.title,
          ...(item.description ? { description: item.description } : {}),
          medium: item.medium,
          imageUrl,
          mediaUrls: item.mediaUrls?.length ? item.mediaUrls : [imageUrl],
          genres: exhibition.tags || [],
          tags: [...(exhibition.tags || []), exhibition.title].filter(Boolean),
          ...(location ? { location } : {}),
          ...(exhibitionDate ? { dateKey: toDateKey(exhibitionDate) } : {}),
          ...(item.year ? { year: item.year } : {}),
          createdAtMs: getTimestampMs(exhibition.createdAt),
          detailHref: getArtworkDetailHref(id),
          credit: buildCredit({
            artistName: item.artistName,
            artistPhotoURL: item.artistPhotoURL,
            artistExternalUrl: item.artistExternalUrl,
            artist,
          }),
        }
      })
      .filter((item): item is DiscoveryArtwork => Boolean(item))
  )

  return [...uploaded, ...portfolio, ...exhibitionWorks]
}
