'use client'

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Info,
  Share2,
  X,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { addToArray, removeFromArray } from '../../../../lib/firestore'
import type { PortfolioItem, ArtMedium } from '../../../../lib/schema'

interface PortfolioGalleryProps {
  items: PortfolioItem[]
  artistName?: string
  onClose?: () => void
  initialIndex?: number
  className?: string
  getEngagementKey?: (item: PortfolioItem) => string
}

const formatMedium = (medium: ArtMedium): string =>
  medium.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const readUserKeys = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.top = '-1000px'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

function MediaRenderer({ item, isActive }: { item: PortfolioItem; isActive: boolean }) {
  const mediaUrl = item.mediaUrls[0] || item.thumbnailUrl
  const isVideo = item.mediaUrls.some(
    (url) => url.includes('.mp4') || url.includes('.webm') || url.includes('video')
  )

  if (isVideo) {
    return (
      <video
        src={mediaUrl}
        className="max-h-[62vh] max-w-full rounded-xl object-contain md:max-h-[calc(100vh-230px)]"
        controls={isActive}
        autoPlay={isActive}
        muted
        loop
        playsInline
      />
    )
  }

  return (
    <img
      src={mediaUrl}
      alt={item.title}
      className="max-h-[62vh] max-w-full rounded-xl object-contain md:max-h-[calc(100vh-230px)]"
    />
  )
}

function GalleryAction({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full border text-white transition-colors md:h-12 md:w-12 ${
        active
          ? 'border-bzr-orange bg-bzr-orange hover:bg-bzr-orange/90'
          : 'border-bzr-gray-700 bg-bzr-gray-900 hover:border-bzr-gray-600 hover:bg-bzr-gray-800'
      } ${disabled ? 'cursor-wait opacity-60' : ''}`}
      whileTap={disabled ? undefined : { scale: 0.94 }}
    >
      {children}
    </motion.button>
  )
}

function ArtworkInfo({ item }: { item: PortfolioItem }) {
  return (
    <div>
      <h2 className="font-display text-sm font-semibold text-white md:text-xl">{item.title}</h2>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/45 md:text-sm">
        {item.year && <span>{item.year}</span>}
        <span className="rounded-full bg-white/[0.07] px-2.5 py-1">{formatMedium(item.medium)}</span>
      </div>
      {item.description && (
        <p className="mt-2 line-clamp-2 max-w-prose text-[11px] leading-5 text-white/50 md:mt-4 md:line-clamp-none md:text-sm md:leading-relaxed">
          {item.description}
        </p>
      )}
    </div>
  )
}

function NavButton({
  direction,
  onClick,
  disabled,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled?: boolean
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight

  return (
    <motion.button
      type="button"
      aria-label={direction === 'prev' ? 'Previous artwork' : 'Next artwork'}
      onClick={onClick}
      disabled={disabled}
      className={`absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-bzr-gray-700 bg-black/75 text-white backdrop-blur-md transition-colors hover:border-bzr-orange hover:bg-bzr-orange md:h-12 md:w-12 ${
        direction === 'prev' ? 'left-3 md:left-6' : 'right-3 md:right-6'
      } ${disabled ? 'pointer-events-none opacity-20' : ''}`}
      whileTap={disabled ? undefined : { scale: 0.94 }}
    >
      <Icon size={23} />
    </motion.button>
  )
}

export const PortfolioGallery: React.FC<PortfolioGalleryProps> = ({
  items,
  artistName,
  onClose,
  initialIndex = 0,
  className = '',
  getEngagementKey,
}) => {
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [showInfo, setShowInfo] = useState(true)
  const [direction, setDirection] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<{
    uid: string | null
    loved: Record<string, boolean>
    bookmarked: Record<string, boolean>
  }>({ uid: null, loved: {}, bookmarked: {} })

  const currentItem = items[currentIndex]
  const engagementKey = getEngagementKey?.(currentItem) || currentItem.id

  const lovedKeys = useMemo(() => {
    const keys = new Set(readUserKeys(user?.lovedArtworkKeys))
    if (overrides.uid === user?.uid) {
      Object.entries(overrides.loved).forEach(([key, active]) => {
        if (active) keys.add(key)
        else keys.delete(key)
      })
    }
    return keys
  }, [overrides, user?.lovedArtworkKeys, user?.uid])

  const bookmarkedKeys = useMemo(() => {
    const keys = new Set(readUserKeys(user?.bookmarkedArtworkKeys))
    if (overrides.uid === user?.uid) {
      Object.entries(overrides.bookmarked).forEach(([key, active]) => {
        if (active) keys.add(key)
        else keys.delete(key)
      })
    }
    return keys
  }, [overrides, user?.bookmarkedArtworkKeys, user?.uid])

  const loved = lovedKeys.has(engagementKey)
  const bookmarked = bookmarkedKeys.has(engagementKey)

  const navigateTo = useCallback(
    (nextDirection: 'prev' | 'next') => {
      if (nextDirection === 'prev' && currentIndex > 0) {
        setDirection(-1)
        setCurrentIndex((index) => index - 1)
      } else if (nextDirection === 'next' && currentIndex < items.length - 1) {
        setDirection(1)
        setCurrentIndex((index) => index + 1)
      }
      setFeedback(null)
    },
    [currentIndex, items.length]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
      if (event.key === 'ArrowLeft') navigateTo('prev')
      if (event.key === 'ArrowRight') navigateTo('next')
      if (event.key.toLowerCase() === 'i' && window.innerWidth >= 768) {
        setShowInfo((visible) => !visible)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [navigateTo, onClose])

  const goToIndex = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
    setFeedback(null)
  }

  const handleDragEnd = (_event: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x > 100 || info.velocity.x > 500) navigateTo('prev')
    if (info.offset.x < -100 || info.velocity.x < -500) navigateTo('next')
  }

  const showFeedback = (message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2200)
  }

  const toggleUserKey = async (kind: 'love' | 'save') => {
    if (!user) {
      showFeedback(kind === 'love' ? 'Sign in to love artworks' : 'Sign in to bookmark artworks')
      return
    }

    const field = kind === 'love' ? 'lovedArtworkKeys' : 'bookmarkedArtworkKeys'
    const currentSet = kind === 'love' ? lovedKeys : bookmarkedKeys
    const isActive = currentSet.has(engagementKey)
    const overrideKey = kind === 'love' ? 'loved' : 'bookmarked'
    const actionKey = `${engagementKey}:${kind}`

    setPendingAction(actionKey)
    setOverrides((current) => {
      const next = current.uid === user.uid ? current : { uid: user.uid, loved: {}, bookmarked: {} }
      return {
        ...next,
        [overrideKey]: { ...next[overrideKey], [engagementKey]: !isActive },
      }
    })

    const result = isActive
      ? await removeFromArray('users', user.uid, field, engagementKey)
      : await addToArray('users', user.uid, field, engagementKey)

    setPendingAction(null)

    if (!result.success) {
      setOverrides((current) => {
        const next = current.uid === user.uid ? current : { uid: user.uid, loved: {}, bookmarked: {} }
        return {
          ...next,
          [overrideKey]: { ...next[overrideKey], [engagementKey]: isActive },
        }
      })
      showFeedback('Could not update artwork')
      return
    }

    showFeedback(
      kind === 'love'
        ? isActive ? 'Love removed' : 'Loved artwork'
        : isActive ? 'Bookmark removed' : 'Bookmarked artwork'
    )
  }

  const handleShare = async () => {
    const payload = {
      title: `${currentItem.title}${artistName ? ` by ${artistName}` : ''}`,
      text: currentItem.description || `View ${currentItem.title} on Club BZR.`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(payload)
        showFeedback('Shared artwork')
        return
      }
      await copyTextToClipboard(window.location.href)
      showFeedback('Link copied')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      await copyTextToClipboard(window.location.href)
      showFeedback('Link copied')
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = currentItem.mediaUrls[0] || currentItem.thumbnailUrl
    link.download = `${currentItem.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'club-bzr-artwork'}.jpg`
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showFeedback('Download started')
  }

  const actions = (
    <div className="flex items-center justify-center gap-3 md:gap-2.5">
      <GalleryAction
        label={loved ? 'Remove love' : 'Love artwork'}
        active={loved}
        disabled={pendingAction === `${engagementKey}:love`}
        onClick={() => toggleUserKey('love')}
      >
        <Heart size={20} fill={loved ? 'currentColor' : 'none'} />
      </GalleryAction>
      <GalleryAction
        label={bookmarked ? 'Remove bookmark' : 'Bookmark artwork'}
        active={bookmarked}
        disabled={pendingAction === `${engagementKey}:save`}
        onClick={() => toggleUserKey('save')}
      >
        <Bookmark size={20} fill={bookmarked ? 'currentColor' : 'none'} />
      </GalleryAction>
      <GalleryAction label="Share artwork" onClick={handleShare}>
        <Share2 size={20} />
      </GalleryAction>
      <GalleryAction label="Download artwork" onClick={handleDownload}>
        <Download size={20} />
      </GalleryAction>
    </div>
  )

  const slideVariants = {
    enter: (slideDirection: number) => ({ x: slideDirection > 0 ? 220 : -220, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (slideDirection: number) => ({ x: slideDirection > 0 ? -220 : 220, opacity: 0 }),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#080808] text-white md:overflow-hidden ${className}`}
    >
      <header className="relative z-30 flex h-16 flex-none items-center justify-between border-b border-white/[0.08] px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <motion.button
            type="button"
            aria-label="Close portfolio"
            onClick={onClose}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            whileTap={{ scale: 0.94 }}
          >
            <X size={24} />
          </motion.button>
          {artistName && (
            <h1 className="truncate font-display text-base font-semibold text-white md:text-lg">
              {artistName}&apos;s Portfolio
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-white/50">
            {currentIndex + 1} / {items.length}
          </span>
          <motion.button
            type="button"
            aria-label={showInfo ? 'Hide artwork information' : 'Show artwork information'}
            onClick={() => setShowInfo((visible) => !visible)}
            className={`hidden h-10 w-10 items-center justify-center rounded-full transition-colors md:flex ${
              showInfo ? 'bg-bzr-orange text-white' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'
            }`}
            whileTap={{ scale: 0.94 }}
          >
            <Info size={20} />
          </motion.button>
        </div>
      </header>

      <div className="flex min-h-0 flex-none md:flex-1 md:overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col pb-24 md:overflow-y-auto md:pb-0">
          <div className="relative flex flex-none items-start justify-center px-4 pb-5 pt-3 md:px-8 md:pb-5 md:pt-6">
            <NavButton direction="prev" onClick={() => navigateTo('prev')} disabled={currentIndex === 0} />
            <NavButton direction="next" onClick={() => navigateTo('next')} disabled={currentIndex === items.length - 1} />

            <motion.div
              className="flex w-full max-w-[680px] items-center justify-center md:max-w-none"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={handleDragEnd}
            >
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="flex w-full items-center justify-center"
                >
                  <MediaRenderer item={currentItem} isActive />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="mx-auto w-[calc(100%-2rem)] max-w-[680px] md:hidden">
            <div className="space-y-4 border-t border-white/[0.08] py-5">
              {actions}
              <ArtworkInfo item={currentItem} />
              {feedback && <p className="text-center text-xs text-bzr-orange">{feedback}</p>}
            </div>
          </div>

          <div className="relative z-30 mx-auto w-[calc(100%-2rem)] max-w-[680px] flex-none pb-5 pt-1 md:w-full md:max-w-none md:px-8 md:pb-5 md:pt-3">
            <div className="flex min-w-full justify-center gap-3 overflow-x-auto py-1 md:gap-2.5">
              {items.map((item, index) => (
                <motion.button
                  type="button"
                  key={item.id}
                  aria-label={`View ${item.title}`}
                  onClick={() => goToIndex(index)}
                  className={`h-12 w-12 flex-none overflow-hidden rounded-lg border-2 transition-colors md:h-14 md:w-14 ${
                    index === currentIndex ? 'border-bzr-orange' : 'border-transparent opacity-55 hover:opacity-90'
                  }`}
                  whileTap={{ scale: 0.96 }}
                >
                  <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showInfo && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="hidden flex-none overflow-hidden border-l border-white/[0.08] bg-white/[0.035] md:block"
            >
              <div className="flex h-full w-72 flex-col gap-6 overflow-y-auto p-6">
                <ArtworkInfo item={currentItem} />
                <div className="flex justify-center">{actions}</div>
                {feedback && <p className="text-xs text-bzr-orange">{feedback}</p>}
                {currentItem.mediaUrls.length > 1 && (
                  <div className="mt-auto">
                    <p className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">
                      {currentItem.mediaUrls.length} images
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {currentItem.mediaUrls.slice(0, 6).map((url, index) => (
                        <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  )
}

export type { PortfolioGalleryProps }
