'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QuestCard, QuestCardSkeleton } from './QuestCard';
import type { Quest } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface QuestGridProps {
  quests: Quest[];
  loading?: boolean;
  error?: Error | null;
  onQuestClick?: (quest: Quest) => void;
  emptyMessage?: string;
  className?: string;
  skeletonCount?: number;
}

// Empty state component
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-full flex flex-col items-center justify-center py-20 px-4"
  >
    {/* Animated illustration */}
    <motion.div
      className="relative w-32 h-32 mb-6"
      animate={{
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg
        viewBox="0 0 128 128"
        fill="none"
        className="w-full h-full"
      >
        {/* Compass/Quest icon */}
        <circle
          cx="64"
          cy="64"
          r="50"
          stroke="#525252"
          strokeWidth="2"
          strokeDasharray="8 4"
        />
        <motion.circle
          cx="64"
          cy="64"
          r="35"
          stroke="#CCFF00"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.path
          d="M64 30L64 64L88 50"
          stroke="#CCFF00"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ transformOrigin: '64px 64px' }}
        />
      </svg>
    </motion.div>

    <h3 className="font-display text-xl text-bzr-white mb-2">
      No Quests Found
    </h3>
    <p className="text-bzr-gray-400 text-center max-w-md">
      {message}
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
      Something went wrong
    </h3>
    <p className="text-bzr-gray-400 text-center max-w-md mb-6">
      {error.message || 'Failed to load quests. Please try again.'}
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

// Grid container variants for stagger animation
const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

export const QuestGrid: React.FC<QuestGridProps> = ({
  quests,
  loading = false,
  error = null,
  onQuestClick,
  emptyMessage = 'No quests available right now. Check back soon for new creative challenges!',
  className,
  skeletonCount = 6,
}) => {
  // Loading state
  if (loading) {
    return (
      <div
        className={cn(
          'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
          className
        )}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <QuestCardSkeleton key={i} featured={i === 0} />
        ))}
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

  // Empty state
  if (quests.length === 0) {
    return (
      <div className={cn('min-h-[400px]', className)}>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  // Separate featured and regular quests
  const featuredQuest = quests.find((q) => q.featured);
  const regularQuests = quests.filter((q) => !q.featured);

  return (
    <motion.div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
        className
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout">
        {/* Featured quest first (spans 2 columns on larger screens) */}
        {featuredQuest && (
          <motion.div
            key={featuredQuest.id}
            variants={itemVariants}
            layout
            className="md:col-span-2"
          >
            <QuestCard
              quest={featuredQuest}
              onClick={() => onQuestClick?.(featuredQuest)}
              featured
            />
          </motion.div>
        )}

        {/* Regular quests */}
        {regularQuests.map((quest) => (
          <motion.div
            key={quest.id}
            variants={itemVariants}
            layout
          >
            <QuestCard
              quest={quest}
              onClick={() => onQuestClick?.(quest)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export type { QuestGridProps };
