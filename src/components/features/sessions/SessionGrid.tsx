'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SessionCard, SessionCardSkeleton } from './SessionCard';
import type { Session } from '../../../../lib/schema';
import { Timestamp } from 'firebase/firestore';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

type TabType = 'upcoming' | 'past';

interface SessionGridProps {
  sessions: Session[];
  loading?: boolean;
  error?: Error | null;
  onSessionClick?: (session: Session) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  className?: string;
  skeletonCount?: number;
}

// Tab button component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}> = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={cn(
      'relative px-6 py-3 font-display text-sm transition-colors',
      active ? 'text-bzr-white' : 'text-bzr-gray-400 hover:text-bzr-gray-300'
    )}
  >
    {children}
    {count !== undefined && count > 0 && (
      <span
        className={cn(
          'ml-2 px-2 py-0.5 text-xs rounded-full',
          active ? 'bg-bzr-blue text-bzr-white' : 'bg-bzr-gray-700 text-bzr-gray-400'
        )}
      >
        {count}
      </span>
    )}
    {active && (
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-bzr-blue"
        layoutId="activeSessionTab"
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    )}
  </button>
);

// Empty state component
const EmptyState: React.FC<{ type: TabType }> = ({ type }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-full flex flex-col items-center justify-center py-20 px-4"
  >
    <motion.div
      className="w-24 h-24 mb-6 text-bzr-gray-600"
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg viewBox="0 0 96 96" fill="none" className="w-full h-full">
        <rect
          x="12"
          y="20"
          width="72"
          height="60"
          rx="8"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M12 36H84"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="24"
          y="12"
          width="12"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <rect
          x="60"
          y="12"
          width="12"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Calendar day indicators */}
        <circle cx="32" cy="52" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="48" cy="52" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="64" cy="52" r="4" fill="currentColor" opacity="0.5" />
      </svg>
    </motion.div>

    <h3 className="font-display text-xl text-bzr-white mb-2">
      {type === 'upcoming' ? 'No Upcoming Sessions' : 'No Past Sessions'}
    </h3>
    <p className="text-bzr-gray-400 text-center max-w-md">
      {type === 'upcoming'
        ? "We're planning new sessions! Check back soon or subscribe to get notified."
        : "Previous sessions will appear here once they've taken place."}
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
      Couldn&apos;t Load Sessions
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

// Grid container animation variants
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

export const SessionGrid: React.FC<SessionGridProps> = ({
  sessions,
  loading = false,
  error = null,
  onSessionClick,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  className,
  skeletonCount = 6,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  // Separate sessions by date
  const now = new Date();
  const upcomingSessions = sessions.filter((s) => {
    const date = s.date instanceof Timestamp ? s.date.toDate() : s.date;
    return date >= now && s.status !== 'cancelled';
  });
  const pastSessions = sessions.filter((s) => {
    const date = s.date instanceof Timestamp ? s.date.toDate() : s.date;
    return date < now || s.status === 'cancelled';
  });

  const displayedSessions = activeTab === 'upcoming' ? upcomingSessions : pastSessions;

  // Find featured session (most recent upcoming or first in list)
  const featuredSession = upcomingSessions.find((s) => s.featured) || upcomingSessions[0];

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        {/* Tabs skeleton */}
        <div className="flex border-b border-bzr-gray-800 mb-6">
          <div className="px-6 py-3 h-12 w-28 bg-bzr-gray-800 rounded animate-pulse" />
          <div className="px-6 py-3 h-12 w-24 bg-bzr-gray-800 rounded animate-pulse ml-2" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SessionCardSkeleton key={i} featured={i === 0} />
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
      {/* Tabs */}
      <div className="flex border-b border-bzr-gray-800 mb-6">
        <TabButton
          active={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
          count={upcomingSessions.length}
        >
          Upcoming
        </TabButton>
        <TabButton
          active={activeTab === 'past'}
          onClick={() => setActiveTab('past')}
          count={pastSessions.length}
        >
          Past
        </TabButton>
      </div>

      {/* Sessions grid */}
      <AnimatePresence mode="wait">
        {displayedSessions.length === 0 ? (
          <EmptyState type={activeTab} />
        ) : (
          <motion.div
            key={activeTab}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {displayedSessions.map((session, index) => (
              <motion.div
                key={session.id}
                variants={itemVariants}
                layout
                className={cn(
                  activeTab === 'upcoming' &&
                    index === 0 &&
                    session.id === featuredSession?.id &&
                    'md:col-span-2'
                )}
              >
                <SessionCard
                  session={session}
                  onClick={() => onSessionClick?.(session)}
                  featured={
                    activeTab === 'upcoming' &&
                    index === 0 &&
                    session.id === featuredSession?.id
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load more button */}
      {hasMore && onLoadMore && (
        <motion.div
          className="flex justify-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={cn(
              'px-8 py-3 rounded-xl font-display text-sm transition-all',
              'bg-bzr-gray-800 text-bzr-white hover:bg-bzr-gray-700',
              loadingMore && 'opacity-70 cursor-wait'
            )}
            whileHover={!loadingMore ? { scale: 1.02 } : {}}
            whileTap={!loadingMore ? { scale: 0.98 } : {}}
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <motion.span
                  className="w-4 h-4 border-2 border-bzr-gray-500 border-t-bzr-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                Loading...
              </span>
            ) : (
              'Load More Sessions'
            )}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export type { SessionGridProps, TabType };
