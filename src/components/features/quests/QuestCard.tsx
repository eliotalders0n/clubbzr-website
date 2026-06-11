'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Quest, QuestDifficulty, QuestCategory } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface QuestCardProps {
  quest: Quest;
  onClick?: () => void;
  className?: string;
  featured?: boolean;
}

// Difficulty visual indicator
const DifficultyIndicator: React.FC<{ difficulty: QuestDifficulty }> = ({ difficulty }) => {
  const levels: Record<QuestDifficulty, number> = {
    any: 1,
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };

  const dots = levels[difficulty] || 1;
  const maxDots = 3;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxDots }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            'w-2 h-2 rounded-full',
            i < dots ? 'bg-bzr-green' : 'bg-bzr-gray-700'
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.1, type: 'spring', stiffness: 500 }}
        />
      ))}
      <span className="ml-2 text-xs text-bzr-gray-400 capitalize font-mono">
        {difficulty}
      </span>
    </div>
  );
};

// Category badge
const CategoryBadge: React.FC<{ category: QuestCategory }> = ({ category }) => {
  const categoryColors: Record<QuestCategory, string> = {
    daily_prompt: 'bg-bzr-blue/20 text-bzr-blue border-bzr-blue/30',
    weekly_challenge: 'bg-bzr-orange/20 text-bzr-orange border-bzr-orange/30',
    collaboration: 'bg-bzr-lavender/20 text-bzr-lavender border-bzr-lavender/30',
    exploration: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    skill_building: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    community: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    experimental: 'bg-bzr-green/20 text-bzr-green border-bzr-green/30',
  };

  const formatCategory = (cat: QuestCategory) =>
    cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span
      className={cn(
        'px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full border',
        categoryColors[category]
      )}
    >
      {formatCategory(category)}
    </span>
  );
};

// Kinetic text effect on hover
const KineticTitle: React.FC<{ text: string; isHovered: boolean }> = ({ text, isHovered }) => {
  const characters = text.split('');

  return (
    <span className="inline-flex flex-wrap">
      {characters.map((char, index) => (
        <motion.span
          key={index}
          className="inline-block"
          style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
          animate={{
            y: isHovered ? [0, -4, 0] : 0,
            color: isHovered ? '#CCFF00' : '#FAF9F6',
          }}
          transition={{
            y: {
              delay: index * 0.02,
              duration: 0.3,
              ease: 'easeOut',
            },
            color: {
              duration: 0.2,
            },
          }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
};

export const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  onClick,
  className,
  featured = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.article
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer',
        'bg-bzr-gray-900/80 backdrop-blur-sm',
        'border border-bzr-gray-800',
        'transition-colors duration-300',
        featured && 'md:col-span-2 md:row-span-2',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Featured highlight glow */}
      {featured && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-bzr-green/10 via-transparent to-bzr-blue/10"
          animate={{
            opacity: isHovered ? 0.8 : 0.4,
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Border glow on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          boxShadow: '0 0 0 1px rgba(204, 255, 0, 0)',
        }}
        animate={{
          boxShadow: isHovered
            ? '0 0 30px rgba(204, 255, 0, 0.2), inset 0 0 30px rgba(204, 255, 0, 0.05)'
            : '0 0 0 1px rgba(204, 255, 0, 0)',
        }}
        transition={{ duration: 0.3 }}
      />

      <div className={cn('relative z-10 p-6', featured && 'md:p-8')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <CategoryBadge category={quest.category} />
          {quest.featured && (
            <motion.span
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-bzr-green text-bzr-black rounded-full"
              animate={{ scale: isHovered ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              Featured
            </motion.span>
          )}
        </div>

        {/* Title with kinetic effect */}
        <h3
          className={cn(
            'font-display font-bold tracking-tight mb-3',
            featured ? 'text-2xl md:text-3xl' : 'text-xl'
          )}
        >
          <KineticTitle text={quest.title} isHovered={isHovered} />
        </h3>

        {/* Description */}
        <p
          className={cn(
            'text-bzr-gray-400 mb-4 line-clamp-2',
            featured ? 'text-base md:text-lg' : 'text-sm'
          )}
        >
          {quest.description}
        </p>

        {/* Expanded details on hover */}
        <AnimatePresence>
          {isHovered && quest.constraints.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 mb-4">
                {quest.constraints.slice(0, 3).map((constraint, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-bzr-gray-800 text-bzr-gray-300 rounded font-mono"
                  >
                    {constraint.type}: {constraint.description}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-bzr-gray-800">
          <DifficultyIndicator difficulty={quest.difficulty} />

          <div className="flex items-center gap-4">
            {/* Submission count */}
            <div className="flex items-center gap-2 text-bzr-gray-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm font-mono">
                {quest.submissionCount}
              </span>
            </div>

            {/* Points */}
            <div className="flex items-center gap-1 text-bzr-green">
              <span className="text-sm font-bold">+{quest.points}</span>
              <span className="text-xs">pts</span>
            </div>
          </div>
        </div>

        {/* Animated arrow on hover */}
        <motion.div
          className="absolute bottom-6 right-6 text-bzr-green"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </motion.div>
      </div>
    </motion.article>
  );
};

// Skeleton loader for QuestCard
export const QuestCardSkeleton: React.FC<{ featured?: boolean; className?: string }> = ({
  featured = false,
  className,
}) => (
  <div
    className={cn(
      'relative rounded-2xl overflow-hidden',
      'bg-bzr-gray-900/80 backdrop-blur-sm',
      'border border-bzr-gray-800',
      featured && 'md:col-span-2 md:row-span-2',
      className
    )}
  >
    <div className={cn('p-6', featured && 'md:p-8')}>
      {/* Category skeleton */}
      <div className="h-6 w-24 bg-bzr-gray-800 rounded-full mb-4 animate-pulse" />

      {/* Title skeleton */}
      <div className="h-8 w-3/4 bg-bzr-gray-800 rounded mb-3 animate-pulse" />

      {/* Description skeleton */}
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-bzr-gray-800 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-bzr-gray-800 rounded animate-pulse" />
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-bzr-gray-800">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-2 h-2 bg-bzr-gray-800 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="h-5 w-16 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

export type { QuestCardProps };
