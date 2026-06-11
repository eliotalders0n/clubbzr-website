'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArtistCard, ArtistCardSkeleton } from './ArtistCard';
import type { Artist } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface ArtistGridProps {
  artists: Artist[];
  loading?: boolean;
  error?: Error | null;
  onArtistClick?: (artist: Artist) => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  className?: string;
  skeletonCount?: number;
}

// Search bar component
const SearchBar: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = 'Search artists...' }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className={cn(
        'relative flex items-center rounded-xl transition-all duration-300',
        'bg-bzr-gray-900 border',
        isFocused ? 'border-bzr-blue shadow-glow-blue' : 'border-bzr-gray-800'
      )}
      animate={{
        scale: isFocused ? 1.01 : 1,
      }}
    >
      <svg
        className={cn(
          'w-5 h-5 ml-4 transition-colors',
          isFocused ? 'text-bzr-blue' : 'text-bzr-gray-500'
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-transparent text-bzr-white placeholder-bzr-gray-500 focus:outline-none"
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => onChange('')}
          className="mr-4 p-1 rounded-full hover:bg-bzr-gray-800 text-bzr-gray-500 hover:text-bzr-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </motion.button>
      )}
    </motion.div>
  );
};

// Empty state component
const EmptyState: React.FC<{ query: string }> = ({ query }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-full flex flex-col items-center justify-center py-20 px-4"
  >
    <motion.div
      className="w-24 h-24 mb-6 text-bzr-gray-600"
      animate={{
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg viewBox="0 0 96 96" fill="none" className="w-full h-full">
        {/* Artist palette icon */}
        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="32" cy="36" r="6" fill="currentColor" opacity="0.5" />
        <circle cx="48" cy="28" r="5" fill="currentColor" opacity="0.5" />
        <circle cx="64" cy="36" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="36" cy="52" r="4" fill="currentColor" opacity="0.5" />
        <ellipse cx="52" cy="60" rx="16" ry="12" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    </motion.div>

    <h3 className="font-display text-xl text-bzr-white mb-2">
      {query ? 'No Artists Found' : 'No Artists Yet'}
    </h3>
    <p className="text-bzr-gray-400 text-center max-w-md">
      {query
        ? `We couldn't find any artists matching "${query}". Try adjusting your search or filters.`
        : 'Artists will appear here once they join the community.'}
    </p>
  </motion.div>
);

// Error state component
const ErrorState: React.FC<{ error: Error; onRetry?: () => void }> = ({ error, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-full flex flex-col items-center justify-center py-20 px-4"
  >
    <div className="w-16 h-16 mb-6 text-bzr-orange">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>

    <h3 className="font-display text-xl text-bzr-white mb-2">
      Couldn&apos;t Load Artists
    </h3>
    <p className="text-bzr-gray-400 text-center max-w-md mb-6">
      {error.message || 'Something went wrong. Please try again.'}
    </p>

    {onRetry && (
      <motion.button
        onClick={onRetry}
        className="px-6 py-2 bg-bzr-blue text-bzr-white rounded-lg font-display text-sm"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Try Again
      </motion.button>
    )}
  </motion.div>
);

// Grid animation variants
const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

export const ArtistGrid: React.FC<ArtistGridProps> = ({
  artists,
  loading = false,
  error = null,
  onArtistClick,
  onSearch,
  searchQuery = '',
  className,
  skeletonCount = 8,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Handle search with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      onSearch?.(value);
    },
    [onSearch]
  );

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        {/* Search skeleton */}
        <div className="h-12 bg-bzr-gray-800 rounded-xl mb-6 animate-pulse" />

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <ArtistCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('min-h-[400px]', className)}>
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Search bar */}
      {onSearch && (
        <div className="mb-6">
          <SearchBar
            value={localQuery}
            onChange={handleSearchChange}
            placeholder="Search by name, medium, or style..."
          />
        </div>
      )}

      {/* Results count */}
      {artists.length > 0 && (
        <motion.p
          className="text-sm text-bzr-gray-500 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Showing {artists.length} artist{artists.length !== 1 && 's'}
          {localQuery && ` for "${localQuery}"`}
        </motion.p>
      )}

      {/* Artists grid */}
      <AnimatePresence mode="wait">
        {artists.length === 0 ? (
          <EmptyState query={localQuery} />
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {artists.map((artist) => (
              <motion.div key={artist.id} variants={itemVariants} layout>
                <ArtistCard
                  artist={artist}
                  onClick={() => onArtistClick?.(artist)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export type { ArtistGridProps };
