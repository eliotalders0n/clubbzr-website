'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { GalleryItem } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface SessionGalleryProps {
  items: GalleryItem[];
  className?: string;
}

const GalleryTile: React.FC<{
  item: GalleryItem;
  index: number;
  onClick: () => void;
}> = ({ item, index, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="group relative h-[220px] overflow-hidden rounded-xl bg-bzr-gray-800 cursor-pointer sm:h-[248px] md:h-[276px] lg:h-[300px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-bzr-gray-800 animate-pulse" />
      )}

      {/* Image */}
      <motion.img
        src={item.thumbnailUrl || item.url}
        alt={item.caption || 'Gallery image'}
        className="h-full w-full object-cover"
        onLoad={() => setIsLoaded(true)}
        animate={{
          scale: isHovered ? 1.06 : 1,
        }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Overlay on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-bzr-black/80 via-bzr-black/20 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Caption and credit overlay */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-4 sm:p-5"
        initial={{ y: 20, opacity: 0 }}
        animate={{
          y: isHovered ? 0 : 20,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        {item.caption && (
          <p className="text-sm text-bzr-white mb-1">{item.caption}</p>
        )}
        {item.credit && (
          <p className="text-xs text-bzr-gray-400">Photo by {item.credit}</p>
        )}
      </motion.div>

      {/* Expand icon */}
      <motion.div
        className="absolute top-3 right-3 sm:top-4 sm:right-4"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: isHovered ? 1 : 0,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="w-9 h-9 rounded-full bg-bzr-black/60 backdrop-blur-sm flex items-center justify-center sm:h-10 sm:w-10">
          <svg
            className="w-5 h-5 text-bzr-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Lightbox component
const Lightbox: React.FC<{
  items: GalleryItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onSelect: (index: number) => void;
}> = ({ items, currentIndex, onClose, onNavigate, onSelect }) => {
  const item = items[currentIndex];

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate('prev');
      if (e.key === 'ArrowRight') onNavigate('next');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bzr-black/95 backdrop-blur-lg"
      onClick={onClose}
    >
      {/* Close button */}
      <motion.button
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-bzr-gray-800/80 text-bzr-white transition-colors hover:bg-bzr-gray-700 sm:h-12 sm:w-12"
        onClick={onClose}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </motion.button>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <motion.button
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bzr-gray-800/80 text-bzr-white transition-colors hover:bg-bzr-gray-700 sm:left-4 sm:h-12 sm:w-12"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('prev');
          }}
          whileHover={{ scale: 1.1, x: -4 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </motion.button>
      )}

      {currentIndex < items.length - 1 && (
        <motion.button
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bzr-gray-800/80 text-bzr-white transition-colors hover:bg-bzr-gray-700 sm:right-4 sm:h-12 sm:w-12"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('next');
          }}
          whileHover={{ scale: 1.1, x: 4 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </motion.button>
      )}

      {/* Image container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="relative flex max-h-[84vh] max-w-[92vw] flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={item.url}
            alt={item.caption || 'Gallery image'}
            className="max-h-[70vh] max-w-full rounded-lg object-contain sm:max-h-[78vh]"
          />

          {/* Photo info panel */}
          <motion.div
            className="mt-3 text-center sm:mt-4"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {item.caption && (
              <p className="text-bzr-white text-lg mb-1">{item.caption}</p>
            )}
            {item.credit && (
              <p className="text-bzr-gray-400 text-sm">Photo by {item.credit}</p>
            )}
            <p className="text-bzr-gray-500 text-sm mt-2">
              {currentIndex + 1} / {items.length}
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Thumbnail strip */}
      <div className="absolute bottom-4 left-1/2 flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-xl bg-bzr-gray-900/80 p-2 backdrop-blur-sm">
        {items.map((thumbItem, index) => (
          <motion.button
            key={thumbItem.id}
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden',
              index === currentIndex && 'ring-2 ring-bzr-blue'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(index);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <img
              src={thumbItem.thumbnailUrl || thumbItem.url}
              alt=""
              className="w-full h-full object-cover"
            />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export const SessionGallery: React.FC<SessionGalleryProps> = ({
  items,
  className,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Open lightbox
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    document.body.style.overflow = 'hidden';
  }, []);

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    document.body.style.overflow = '';
  }, []);

  // Navigate lightbox
  const navigateLightbox = useCallback(
    (direction: 'prev' | 'next') => {
      if (lightboxIndex === null) return;
      if (direction === 'prev' && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
      } else if (direction === 'next' && lightboxIndex < items.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
      }
    },
    [lightboxIndex, items.length]
  );

  const selectLightboxItem = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  // Empty state
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 text-center',
          className
        )}
      >
        <div className="w-16 h-16 mb-4 text-bzr-gray-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 15l-5-5L5 21"
            />
          </svg>
        </div>
        <h3 className="font-display text-lg text-bzr-white mb-1">No Photos Yet</h3>
        <p className="text-sm text-bzr-gray-400">
          Photos from this session will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Gallery grid */}
      <div
        className={cn(
          'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
          className
        )}
      >
        {items.map((item, index) => (
          <GalleryTile
            key={item.id}
            item={item}
            index={index}
            onClick={() => openLightbox(index)}
          />
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            items={items}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNavigate={navigateLightbox}
            onSelect={selectLightboxItem}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export type { SessionGalleryProps };
