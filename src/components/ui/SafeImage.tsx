'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Box, Image, Text, VStack, type BoxProps, type ImageProps } from '@chakra-ui/react'
import { ImageOff } from 'lucide-react'

export interface SafeImageProps extends Omit<ImageProps, 'src' | 'fallback'> {
  /** Primary image source. */
  src?: string | null
  /** Extra sources tried in order when the primary one fails. */
  fallbackSrcs?: (string | null | undefined)[]
  /** Short line shown inside the placeholder instead of the raw alt text. */
  placeholderLabel?: string
  /** Placeholder icon size in px. Defaults to a size that fits most cards. */
  placeholderIconSize?: number
  /** Styling overrides for the placeholder surface. */
  placeholderProps?: BoxProps
  /** Replaces the default placeholder entirely (e.g. avatar initials). */
  fallback?: ReactNode
  /**
   * Fires once no source is left to try. The feed uses this to drop items
   * whose media 404s, which only the browser can discover.
   */
  onSourcesExhausted?: () => void
}

const isUsable = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/**
 * Image that degrades to a branded placeholder instead of the browser's
 * broken-image glyph + alt text. Extra sources are tried in order first.
 */
export function SafeImage({
  src,
  fallbackSrcs,
  alt,
  placeholderLabel,
  placeholderIconSize = 28,
  placeholderProps,
  fallback,
  className,
  onSourcesExhausted,
  ...imageProps
}: SafeImageProps) {
  const candidates = useMemo(
    () => [src, ...(fallbackSrcs ?? [])].filter(isUsable),
    [src, fallbackSrcs],
  )
  const candidateKey = candidates.join('|')
  const [failed, setFailed] = useState<{ key: string; urls: Record<string, true> }>({
    key: candidateKey,
    urls: {},
  })

  // A new set of candidates (e.g. a re-uploaded image) gets a fresh chance.
  const failedUrls = failed.key === candidateKey ? failed.urls : {}
  const current = candidates.find((candidate) => !failedUrls[candidate])

  if (!current) {
    if (fallback !== undefined) return <>{fallback}</>

    return (
      <Box
        w={className ? undefined : 'full'}
        h={className ? undefined : 'full'}
        minH="inherit"
        bg="gray.900"
        bgGradient="to-br"
        gradientFrom="whiteAlpha.100"
        gradientTo="transparent"
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="whiteAlpha.400"
        aria-label={alt || placeholderLabel || 'Image unavailable'}
        role="img"
        className={className}
        {...placeholderProps}
      >
        <VStack gap={2} px={4} textAlign="center">
          <ImageOff size={placeholderIconSize} strokeWidth={1.5} />
          {placeholderLabel && (
            <Text
              fontSize="xs"
              fontWeight="medium"
              letterSpacing="0.08em"
              textTransform="uppercase"
              color="whiteAlpha.500"
              lineClamp={2}
            >
              {placeholderLabel}
            </Text>
          )}
        </VStack>
      </Box>
    )
  }

  return (
    <Image
      key={current}
      src={current}
      alt={alt}
      className={className}
      onError={() => {
        const urls: Record<string, true> = { ...failedUrls, [current]: true }
        setFailed({ key: candidateKey, urls })

        if (candidates.every((candidate) => urls[candidate])) {
          onSourcesExhausted?.()
        }
      }}
      {...imageProps}
    />
  )
}
