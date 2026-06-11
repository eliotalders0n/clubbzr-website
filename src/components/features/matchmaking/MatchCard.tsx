'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ArtMedium } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface MatchUser {
  id: string;
  name: string;
  photoURL?: string;
  bio?: string;
  mediums: ArtMedium[];
  interests?: string[];
  location?: string;
}

interface MatchCardProps {
  match: MatchUser;
  matchScore: number;
  commonInterests: string[];
  onConnect: () => void;
  onSkip: () => void;
  status?: 'suggested' | 'connected' | 'pending';
  className?: string;
}

// Medium badge colors
const mediumColors: Record<string, string> = {
  painting: 'bg-bzr-blue/20 text-bzr-blue border-bzr-blue/30',
  sculpture: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  photography: 'bg-bzr-green/20 text-bzr-green border-bzr-green/30',
  digital: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  illustration: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  mixed_media: 'bg-bzr-orange/20 text-bzr-orange border-bzr-orange/30',
  installation: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  performance: 'bg-red-500/20 text-red-400 border-red-500/30',
  video: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  animation: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  textile: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  ceramics: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  printmaking: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  collage: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  street_art: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  conceptual: 'bg-bzr-lavender/20 text-bzr-lavender border-bzr-lavender/30',
  other: 'bg-bzr-gray-700/50 text-bzr-gray-300 border-bzr-gray-600',
};

const formatMedium = (medium: ArtMedium) =>
  medium.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  matchScore,
  commonInterests,
  onConnect,
  onSkip,
  status = 'suggested',
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.article
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'bg-bzr-gray-900/80 backdrop-blur-sm',
        'border border-bzr-gray-800',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Match score indicator */}
      <div className="absolute top-4 right-4 z-10">
        <motion.div
          className="relative"
          animate={{ rotate: isHovered ? 360 : 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <svg className="w-14 h-14" viewBox="0 0 56 56">
            {/* Background circle */}
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="rgba(38, 38, 38, 0.8)"
              strokeWidth="4"
            />
            {/* Progress circle */}
            <motion.circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke={matchScore >= 80 ? '#CCFF00' : matchScore >= 60 ? '#0066FF' : '#FF6B35'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(matchScore / 100) * 150.8} 150.8`}
              transform="rotate(-90 28 28)"
              initial={{ strokeDasharray: '0 150.8' }}
              animate={{ strokeDasharray: `${(matchScore / 100) * 150.8} 150.8` }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-bzr-white">
            {matchScore}%
          </span>
        </motion.div>
      </div>

      <div className="p-6">
        {/* Avatar and basic info */}
        <div className="flex items-start gap-4 mb-4">
          <motion.div
            className="relative flex-shrink-0"
            whileHover={{ scale: 1.05 }}
          >
            {match.photoURL ? (
              <img
                src={match.photoURL}
                alt={match.name}
                className="w-20 h-20 rounded-xl object-cover border-2 border-bzr-gray-700"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-bzr-blue to-bzr-lavender flex items-center justify-center border-2 border-bzr-gray-700">
                <span className="text-2xl font-bold text-bzr-white">
                  {match.name.charAt(0)}
                </span>
              </div>
            )}

            {/* Status indicator */}
            {status === 'connected' && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-bzr-green rounded-full flex items-center justify-center border-2 border-bzr-gray-900">
                <svg className="w-3 h-3 text-bzr-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </motion.div>

          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl font-bold text-bzr-white mb-1">
              {match.name}
            </h3>
            {match.location && (
              <p className="text-sm text-bzr-gray-400 flex items-center gap-1 mb-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {match.location}
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {match.bio && (
          <p className="text-bzr-gray-400 text-sm mb-4 line-clamp-2">
            {match.bio}
          </p>
        )}

        {/* Mediums */}
        <div className="mb-4">
          <p className="text-xs font-mono uppercase tracking-wider text-bzr-gray-500 mb-2">
            Works with
          </p>
          <div className="flex flex-wrap gap-2">
            {match.mediums.slice(0, 4).map((medium) => (
              <span
                key={medium}
                className={cn(
                  'px-2 py-0.5 text-xs font-mono rounded-full border',
                  mediumColors[medium] || mediumColors.other
                )}
              >
                {formatMedium(medium)}
              </span>
            ))}
            {match.mediums.length > 4 && (
              <span className="px-2 py-0.5 text-xs text-bzr-gray-500">
                +{match.mediums.length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Common interests */}
        {commonInterests.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono uppercase tracking-wider text-bzr-gray-500 mb-2">
              You both like
            </p>
            <div className="flex flex-wrap gap-2">
              {commonInterests.map((interest) => (
                <span
                  key={interest}
                  className="px-2 py-1 text-xs text-bzr-green bg-bzr-green/10 border border-bzr-green/20 rounded-lg"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {status === 'suggested' ? (
            <>
              <motion.button
                onClick={onSkip}
                className="flex-1 px-4 py-3 rounded-xl bg-bzr-gray-800 text-bzr-gray-400 font-medium hover:bg-bzr-gray-700 hover:text-bzr-white transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Skip
              </motion.button>
              <motion.button
                onClick={onConnect}
                className="flex-1 px-4 py-3 rounded-xl bg-bzr-blue text-bzr-white font-medium hover:shadow-glow-blue transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Connect
              </motion.button>
            </>
          ) : status === 'pending' ? (
            <div className="flex-1 px-4 py-3 rounded-xl bg-bzr-orange/10 text-bzr-orange text-center font-medium border border-bzr-orange/20">
              Request Pending
            </div>
          ) : (
            <motion.button
              className="flex-1 px-4 py-3 rounded-xl bg-bzr-green/10 text-bzr-green font-medium border border-bzr-green/20"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Connected
              </span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Hover glow effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          boxShadow: isHovered
            ? '0 0 40px rgba(0, 102, 255, 0.15), inset 0 0 30px rgba(0, 102, 255, 0.03)'
            : 'none',
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.article>
  );
};

// Skeleton loader
export const MatchCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'rounded-2xl bg-bzr-gray-900/80 border border-bzr-gray-800 p-6',
      className
    )}
  >
    <div className="flex items-start gap-4 mb-4">
      <div className="w-20 h-20 rounded-xl bg-bzr-gray-800 animate-pulse" />
      <div className="flex-1">
        <div className="h-6 w-32 bg-bzr-gray-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-24 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
      <div className="w-14 h-14 rounded-full bg-bzr-gray-800 animate-pulse" />
    </div>
    <div className="h-4 w-full bg-bzr-gray-800 rounded animate-pulse mb-2" />
    <div className="h-4 w-3/4 bg-bzr-gray-800 rounded animate-pulse mb-4" />
    <div className="flex gap-2 mb-4">
      <div className="h-6 w-20 bg-bzr-gray-800 rounded-full animate-pulse" />
      <div className="h-6 w-24 bg-bzr-gray-800 rounded-full animate-pulse" />
    </div>
    <div className="flex gap-3">
      <div className="flex-1 h-12 bg-bzr-gray-800 rounded-xl animate-pulse" />
      <div className="flex-1 h-12 bg-bzr-gray-800 rounded-xl animate-pulse" />
    </div>
  </div>
);

export type { MatchCardProps, MatchUser };
