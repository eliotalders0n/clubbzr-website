'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PortfolioItem, ArtMedium } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface PortfolioGalleryProps {
  items: PortfolioItem[];
  artistName?: string;
  onClose?: () => void;
  initialIndex?: number;
  className?: string;
}

// Format medium for display
const formatMedium = (medium: ArtMedium): string =>
  medium.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

// Media renderer component
const MediaRenderer: React.FC<{
  item: PortfolioItem;
  isActive: boolean;
}> = ({ item, isActive }) => {
  const isVideo = item.mediaUrls.some(
    (url) => url.includes('.mp4') || url.includes('.webm') || url.includes('video')
  );

  if (isVideo) {
    return (
      <video
        src={item.mediaUrls[0]}
        className="max-w-full max-h-[75vh] object-contain rounded-lg"
        controls={isActive}
        autoPlay={isActive}
        muted
        loop
        playsInline
      />
    );
  }

  return (
    <img
      src={item.mediaUrls[0]}
      alt={item.title}
      className="max-w-full max-h-[75vh] object-contain rounded-lg"
    />
  );
};

// Project info panel
const InfoPanel: React.FC<{
  item: PortfolioItem;
  isVisible: boolean;
}> = ({ item, isVisible }) => (
  <motion.div
    className={cn(
      'absolute right-0 top-0 bottom-0 w-80 bg-bzr-gray-900/95 backdrop-blur-lg border-l border-bzr-gray-800 p-6 overflow-y-auto',
      'transform transition-transform duration-300'
    )}
    initial={{ x: '100%' }}
    animate={{ x: isVisible ? 0 : '100%' }}
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  >
    <h2 className="font-display text-2xl text-bzr-white mb-2">{item.title}</h2>

    {/* Year and medium */}
    <div className="flex items-center gap-3 mb-4">
      {item.year && (
        <span className="text-sm font-mono text-bzr-gray-400">{item.year}</span>
      )}
      <span className="px-2 py-1 text-xs font-mono bg-bzr-gray-800 text-bzr-gray-300 rounded">
        {formatMedium(item.medium)}
      </span>
    </div>

    {/* Description */}
    {item.description && (
      <p className="text-bzr-gray-300 leading-relaxed mb-6">{item.description}</p>
    )}

    {/* External link */}
    {item.externalUrl && (
      <a
        href={item.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-bzr-blue hover:text-bzr-blue/80 transition-colors"
      >
        <span>View on external site</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    )}

    {/* Multiple images indicator */}
    {item.mediaUrls.length > 1 && (
      <div className="mt-6">
        <h4 className="text-xs font-mono uppercase tracking-wider text-bzr-gray-500 mb-3">
          {item.mediaUrls.length} images
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {item.mediaUrls.slice(0, 6).map((url, i) => (
            <div
              key={i}
              className="aspect-square rounded overflow-hidden bg-bzr-gray-800"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    )}
  </motion.div>
);

// Navigation arrow button
const NavButton: React.FC<{
  direction: 'prev' | 'next';
  onClick: () => void;
  disabled?: boolean;
}> = ({ direction, onClick, disabled }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'absolute top-1/2 -translate-y-1/2 z-20',
      'w-14 h-14 rounded-full bg-bzr-gray-900/80 backdrop-blur-sm',
      'flex items-center justify-center',
      'text-bzr-white hover:bg-bzr-gray-800 transition-colors',
      disabled && 'opacity-30 cursor-not-allowed',
      direction === 'prev' ? 'left-4' : 'right-4'
    )}
    whileHover={!disabled ? { scale: 1.1 } : {}}
    whileTap={!disabled ? { scale: 0.9 } : {}}
  >
    <svg
      className={cn('w-6 h-6', direction === 'next' && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  </motion.button>
);

export const PortfolioGallery: React.FC<PortfolioGalleryProps> = ({
  items,
  artistName,
  onClose,
  initialIndex = 0,
  className,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showInfo, setShowInfo] = useState(true);
  const [direction, setDirection] = useState(0);
  const controls = useAnimation();

  const currentItem = items[currentIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose?.();
          break;
        case 'ArrowLeft':
          navigateTo('prev');
          break;
        case 'ArrowRight':
          navigateTo('next');
          break;
        case 'i':
          setShowInfo((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, currentIndex]);

  // Navigate
  const navigateTo = useCallback(
    (dir: 'prev' | 'next') => {
      if (dir === 'prev' && currentIndex > 0) {
        setDirection(-1);
        setCurrentIndex(currentIndex - 1);
      } else if (dir === 'next' && currentIndex < items.length - 1) {
        setDirection(1);
        setCurrentIndex(currentIndex + 1);
      }
    },
    [currentIndex, items.length]
  );

  // Go to specific index
  const goToIndex = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  // Swipe gesture handlers
  const handleDragEnd = (event: never, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 100;
    const velocity = 500;

    if (info.offset.x > threshold || info.velocity.x > velocity) {
      navigateTo('prev');
    } else if (info.offset.x < -threshold || info.velocity.x < -velocity) {
      navigateTo('next');
    }
  };

  // Animation variants
  const slideVariants: any = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 bg-bzr-black/95 backdrop-blur-lg flex flex-col',
        className
      )}
    >
      {/* Header */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-bzr-gray-800">
        <div className="flex items-center gap-4">
          {/* Close button */}
          <motion.button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>

          {/* Artist name */}
          {artistName && (
            <h1 className="font-display text-lg text-bzr-white">
              {artistName}&apos;s Portfolio
            </h1>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Counter */}
          <span className="font-mono text-sm text-bzr-gray-400">
            {currentIndex + 1} / {items.length}
          </span>

          {/* Toggle info panel */}
          <motion.button
            onClick={() => setShowInfo(!showInfo)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showInfo
                ? 'bg-bzr-blue text-bzr-white'
                : 'hover:bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </motion.button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Navigation buttons */}
        <NavButton
          direction="prev"
          onClick={() => navigateTo('prev')}
          disabled={currentIndex === 0}
        />
        <NavButton
          direction="next"
          onClick={() => navigateTo('next')}
          disabled={currentIndex === items.length - 1}
        />

        {/* Image container with swipe */}
        <motion.div
          className="flex items-center justify-center w-full h-full px-20"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
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
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="flex items-center justify-center"
              style={{ maxWidth: showInfo ? 'calc(100% - 320px)' : '100%' }}
            >
              <MediaRenderer item={currentItem} isActive={true} />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Info panel */}
        <InfoPanel item={currentItem} isVisible={showInfo} />
      </div>

      {/* Thumbnail strip */}
      <div className="relative z-30 border-t border-bzr-gray-800 px-6 py-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide justify-center">
          {items.map((item, index) => (
            <motion.button
              key={item.id}
              onClick={() => goToIndex(index)}
              className={cn(
                'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden',
                'border-2 transition-colors',
                index === currentIndex
                  ? 'border-bzr-white'
                  : 'border-transparent hover:border-bzr-gray-600'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className={cn(
                  'w-full h-full object-cover transition-opacity',
                  index === currentIndex ? 'opacity-100' : 'opacity-60'
                )}
              />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="absolute bottom-20 left-6 text-xs text-bzr-gray-600 font-mono hidden md:block">
        <span className="mr-4">ESC close</span>
        <span className="mr-4">LEFT/RIGHT navigate</span>
        <span>I toggle info</span>
      </div>
    </motion.div>
  );
};

export type { PortfolioGalleryProps };
