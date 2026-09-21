/**
 * Media URL Guards
 * Club BZR - Experimental Art Community
 *
 * A media URL only belongs in Firestore if it will still resolve for every
 * other member, on another device, months from now. Object URLs
 * (`blob:`/`data:`) satisfy neither: they die with the tab that created them
 * and are the reason broken images reached the community wall. These helpers
 * are the single place that decides what "persistent" means, so the write
 * paths and the feed agree.
 */

/** Media URL that other members' browsers can still fetch later. */
export const isPersistentMediaUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false

  const url = value.trim()
  if (!url) return false

  return url.startsWith('https://') || url.startsWith('http://')
}

/** Drop anything that would render as a broken image. */
export const filterPersistentMediaUrls = (urls: unknown): string[] =>
  Array.isArray(urls) ? urls.filter(isPersistentMediaUrl) : []

export class MediaUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaUrlError'
  }
}

/**
 * Guard a write path. Throws before the document is created so the member
 * sees an upload error instead of posting an image nobody else can load.
 */
export const assertPersistentMediaUrls = (
  urls: unknown,
  context = 'This post',
): string[] => {
  const list = Array.isArray(urls) ? urls : []
  const rejected = list.filter((url) => !isPersistentMediaUrl(url))

  if (rejected.length > 0) {
    throw new MediaUrlError(
      `${context} still references ${rejected.length} file that was never uploaded. ` +
        'Please retry the upload before posting.',
    )
  }

  return list as string[]
}

/**
 * Does this feed item carry media that is at least structurally loadable?
 * `false` means the item should never be rendered — the URL cannot resolve
 * for anyone, so there is nothing to retry.
 */
export const hasRenderableMedia = (item: {
  mediaUrls?: unknown
  thumbnailUrl?: unknown
}): boolean => {
  const declared = [
    ...(Array.isArray(item.mediaUrls) ? item.mediaUrls : []),
    ...(item.thumbnailUrl === undefined ? [] : [item.thumbnailUrl]),
  ].filter((url) => url !== undefined && url !== null && url !== '')

  // No media at all is fine; a text-only post is not a broken post.
  if (declared.length === 0) return true

  return declared.every(isPersistentMediaUrl)
}
