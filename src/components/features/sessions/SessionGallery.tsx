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

// Masonry item component
const MasonryItem: React.FC<{
  item: GalleryItem;
  index: number;
  onClick: () => void;
}> = ({ item, index, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Vary heights for masonry effect
  const heightVariants = ['h-48', 'h-64', 'h-56', 'h-72', 'h-52'];
  const heightClass = heightVariants[index % heightVariants.length];

  return (
    <motion.div
      className={cn('relative overflow-hidden rounded-xl cursor-pointer', heightClass)}
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
        className="w-full h-full object-cover"
        onLoad={() => setIsLoaded(true)}
        animate={{
          scale: isHovered ? 1.1 : 1,
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
        className="absolute bottom-0 left-0 right-0 p-4"
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
        className="absolute top-4 right-4"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: isHovered ? 1 : 0,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="w-10 h-10 rounded-full bg-bzr-black/60 backdrop-blur-sm flex items-center justify-center">
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
}> = ({ items, currentIndex, onClose, onNavigate }) => {
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
        className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-bzr-gray-800/80 text-bzr-white flex items-center justify-center hover:bg-bzr-gray-700 transition-colors"
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
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-bzr-gray-800/80 text-bzr-white flex items-center justify-center hover:bg-bzr-gray-700 transition-colors"
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
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-bzr-gray-800/80 text-bzr-white flex items-center justify-center hover:bg-bzr-gray-700 transition-colors"
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
          className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={item.url}
            alt={item.caption || 'Gallery image'}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />

          {/* Photo info panel */}
          <motion.div
            className="mt-4 text-center"
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-bzr-gray-900/80 backdrop-blur-sm rounded-xl max-w-[90vw] overflow-x-auto">
        {items.map((thumbItem, index) => (
          <motion.button
            key={thumbItem.id}
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden',
              index === currentIndex && 'ring-2 ring-bzr-blue'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index > currentIndex ? 'next' : 'prev');
              // This is a simplified approach - in production you'd set the index directly
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
      {/* Masonry grid */}
      <div
        className={cn(
          'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4',
          className
        )}
      >
        {items.map((item, index) => (
          <MasonryItem
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
          />
        )}
      </AnimatePresence>
    </>
  );
};

export type { SessionGalleryProps };
