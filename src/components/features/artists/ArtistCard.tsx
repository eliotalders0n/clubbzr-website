'use client';

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Artist, ArtMedium, PortfolioItem } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface ArtistCardProps {
  artist: Artist;
  onClick?: () => void;
  className?: string;
}

// Format medium for display
const formatMedium = (medium: ArtMedium): string =>
  medium.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

// Availability indicator
const AvailabilityIndicator: React.FC<{
  availability: Artist['availability'];
}> = ({ availability }) => {
  const isAvailable =
    availability.forCollaborations ||
    availability.forCommissions ||
    availability.forEvents;

  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        className={cn(
          'w-2 h-2 rounded-full',
          isAvailable ? 'bg-bzr-green' : 'bg-bzr-gray-500'
        )}
        animate={
          isAvailable
            ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }
            : {}
        }
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <span className={cn('text-xs', isAvailable ? 'text-bzr-green' : 'text-bzr-gray-500')}>
        {isAvailable ? 'Available' : 'Busy'}
      </span>
    </div>
  );
};

// Portfolio preview that peeks on hover
const PortfolioPreview: React.FC<{
  items: PortfolioItem[];
  isVisible: boolean;
}> = ({ items, isVisible }) => {
  const previewItems = items.slice(0, 4);

  return (
    <motion.div
      className="absolute inset-0 bg-bzr-black/90 backdrop-blur-sm z-10 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.3 }}
      style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
    >
      <div className="grid grid-cols-2 gap-2 w-full max-w-[200px]">
        {previewItems.map((item, index) => (
          <motion.div
            key={item.id}
            className="aspect-square rounded-lg overflow-hidden bg-bzr-gray-800"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: isVisible ? 1 : 0.8,
              opacity: isVisible ? 1 : 0,
            }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
          >
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        ))}
      </div>

      {/* View profile text */}
      <motion.div
        className="absolute bottom-4 left-0 right-0 text-center"
        initial={{ y: 10, opacity: 0 }}
        animate={{
          y: isVisible ? 0 : 10,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ delay: 0.2 }}
      >
        <span className="px-4 py-2 bg-bzr-white text-bzr-black rounded-full text-sm font-display">
          View Profile
        </span>
      </motion.div>
    </motion.div>
  );
};

export const ArtistCard: React.FC<ArtistCardProps> = ({
  artist,
  onClick,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Tilt effect on hover
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useTransform(mouseY, [0, 1], [5, -5]);
  const rotateY = useTransform(mouseX, [0, 1], [-5, 5]);

  const smoothRotateX = useSpring(rotateX, { damping: 50, stiffness: 200 });
  const smoothRotateY = useSpring(rotateY, { damping: 50, stiffness: 200 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  // Primary medium
  const primaryMedium = artist.mediums[0];

  // Get display name
  const displayName = artist.artistName || artist.name;

  return (
    <motion.article
      ref={cardRef}
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer perspective-1000',
        'bg-bzr-gray-900/80 backdrop-blur-sm',
        'border border-bzr-gray-800',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformStyle: 'preserve-3d',
      }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Portfolio preview on hover */}
      {artist.portfolio.length > 0 && (
        <PortfolioPreview items={artist.portfolio} isVisible={isHovered} />
      )}

      {/* Avatar section */}
      <div className="relative aspect-square overflow-hidden">
        {artist.portfolio[0]?.thumbnailUrl ? (
          <img
            src={artist.portfolio[0].thumbnailUrl}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bzr-gray-800 to-bzr-gray-900 flex items-center justify-center">
            <span className="text-6xl font-display text-bzr-gray-600">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bzr-black via-bzr-black/20 to-transparent" />

        {/* Verified badge */}
        {artist.verified && (
          <motion.div
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-bzr-blue flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <svg className="w-4 h-4 text-bzr-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </motion.div>
        )}

        {/* Featured badge */}
        {artist.featured && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-bzr-green text-bzr-black rounded-full">
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name and availability */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-display text-lg font-bold text-bzr-white group-hover:text-bzr-green transition-colors">
              {displayName}
            </h3>
            {artist.artistName && artist.name !== artist.artistName && (
              <p className="text-xs text-bzr-gray-500">{artist.name}</p>
            )}
          </div>
          <AvailabilityIndicator availability={artist.availability} />
        </div>

        {/* Primary medium */}
        <p className="text-sm text-bzr-gray-400 mb-3">
          {formatMedium(primaryMedium)}
          {artist.mediums.length > 1 && (
            <span className="text-bzr-gray-600"> +{artist.mediums.length - 1} more</span>
          )}
        </p>

        {/* Bio preview */}
        <p className="text-sm text-bzr-gray-500 line-clamp-2 mb-4">
          {artist.bio}
        </p>

        {/* Stats and collaboration */}
        <div className="flex items-center justify-between pt-3 border-t border-bzr-gray-800">
          <div className="flex items-center gap-4 text-xs text-bzr-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {artist.worksCount}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              {artist.followersCount}
            </span>
          </div>

          {artist.openToCollaboration && (
            <span className="text-xs text-bzr-lavender">
              Open to collab
            </span>
          )}
        </div>
      </div>

      {/* Border glow on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          boxShadow: isHovered
            ? '0 0 30px rgba(204, 255, 0, 0.15), inset 0 0 30px rgba(204, 255, 0, 0.03)'
            : '0 0 0 rgba(204, 255, 0, 0)',
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.article>
  );
};

// Skeleton loader
export const ArtistCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'rounded-2xl overflow-hidden bg-bzr-gray-900/80 border border-bzr-gray-800',
      className
    )}
  >
    {/* Avatar skeleton */}
    <div className="aspect-square bg-bzr-gray-800 animate-pulse" />

    {/* Content skeleton */}
    <div className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="h-6 w-32 bg-bzr-gray-800 rounded animate-pulse" />
        <div className="h-4 w-16 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
      <div className="h-4 w-24 bg-bzr-gray-800 rounded mb-3 animate-pulse" />
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full bg-bzr-gray-800 rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-bzr-gray-800">
        <div className="flex gap-4">
          <div className="h-4 w-12 bg-bzr-gray-800 rounded animate-pulse" />
          <div className="h-4 w-12 bg-bzr-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-4 w-20 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

export type { ArtistCardProps };
