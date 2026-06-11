'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Reactions, ReactionType } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface ReactionBarProps {
  reactions: Reactions;
  currentUserId?: string;
  onReaction?: (reactionType: ReactionType) => void | Promise<void>;
  size?: 'sm' | 'md';
  className?: string;
}

// Reaction emoji mappings
const REACTION_EMOJIS: Record<ReactionType, { emoji: string; label: string }> = {
  love: { emoji: '❤️', label: 'Love' },
  fire: { emoji: '🔥', label: 'Fire' },
  mind_blown: { emoji: '🤯', label: 'Mind Blown' },
  inspire: { emoji: '✨', label: 'Inspiring' },
  curious: { emoji: '🤔', label: 'Curious' },
};

// All reaction types
const REACTION_TYPES: ReactionType[] = ['love', 'fire', 'mind_blown', 'inspire', 'curious'];

// Single reaction button
const ReactionButton: React.FC<{
  type: ReactionType;
  count: number;
  isActive: boolean;
  onClick: () => void | Promise<void>;
  size: 'sm' | 'md';
  disabled?: boolean;
}> = ({ type, count, isActive, onClick, size, disabled }) => {
  const { emoji, label } = REACTION_EMOJIS[type];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex items-center gap-1 rounded-full transition-colors',
        size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5',
        isActive
          ? 'bg-bzr-blue/20 text-bzr-blue'
          : 'bg-bzr-gray-800/50 text-bzr-gray-400 hover:bg-bzr-gray-800',
        disabled && 'cursor-wait opacity-60'
      )}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      title={label}
    >
      <motion.span
        className={size === 'sm' ? 'text-sm' : 'text-base'}
        animate={{
          scale: isActive ? [1, 1.3, 1] : 1,
        }}
        transition={{ duration: 0.3 }}
      >
        {emoji}
      </motion.span>
      {count > 0 && (
        <motion.span
          className={cn('font-mono', size === 'sm' ? 'text-xs' : 'text-sm')}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {count}
        </motion.span>
      )}
    </motion.button>
  );
};

// Emoji picker popup
const EmojiPicker: React.FC<{
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (type: ReactionType) => void | Promise<void>;
  onClose: () => void;
  activeReactions: ReactionType[];
  isSubmitting: boolean;
}> = ({ isOpen, anchorRef, onSelect, onClose, activeReactions, isSubmitting }) => {
  const [position, setPosition] = useState({ left: 16, top: 16 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const pickerWidth = 240;
      const left = Math.min(
        Math.max(16, rect.left - 12),
        window.innerWidth - pickerWidth - 16
      );
      const top = rect.top > 88 ? rect.top - 64 : rect.bottom + 12;

      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close reactions"
            className="fixed inset-0 z-[80] cursor-default"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.16 }}
            className="fixed z-[90] flex gap-1 rounded-2xl border border-bzr-gray-700 bg-bzr-gray-900 p-2 shadow-2xl"
            style={{
              left: position.left,
              top: position.top,
              width: '240px',
            }}
          >
            {REACTION_TYPES.map((type) => {
              const { emoji, label } = REACTION_EMOJIS[type];
              const isActive = activeReactions.includes(type);

              return (
                <motion.button
                  key={type}
                  type="button"
                  onClick={async () => {
                    await onSelect(type);
                    onClose();
                  }}
                  disabled={isSubmitting}
                  aria-label={label}
                  className={cn(
                    'flex h-10 w-10 flex-1 items-center justify-center rounded-xl text-xl transition-colors',
                    isActive ? 'bg-bzr-blue/20' : 'hover:bg-bzr-gray-800',
                    isSubmitting && 'cursor-wait opacity-60'
                  )}
                  whileHover={isSubmitting ? {} : { scale: 1.12 }}
                  whileTap={isSubmitting ? {} : { scale: 0.94 }}
                  title={label}
                >
                  {emoji}
                </motion.button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Reaction summary component
const ReactionSummary: React.FC<{
  reactions: Reactions;
  size: 'sm' | 'md';
}> = ({ reactions, size }) => {
  // Get unique emojis that have reactions
  const activeReactions = REACTION_TYPES.filter(
    (type) => reactions[type]?.length > 0
  );

  // Total count
  const totalCount = REACTION_TYPES.reduce(
    (sum, type) => sum + (reactions[type]?.length || 0),
    0
  );

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Stacked emojis */}
      <div className="flex -space-x-1">
        {activeReactions.slice(0, 3).map((type, index) => (
          <motion.span
            key={type}
            className={cn(
              'flex items-center justify-center rounded-full bg-bzr-gray-800',
              size === 'sm' ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-sm'
            )}
            style={{ zIndex: 3 - index }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            {REACTION_EMOJIS[type].emoji}
          </motion.span>
        ))}
      </div>

      {/* Count */}
      <span
        className={cn(
          'font-mono text-bzr-gray-400',
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}
      >
        {totalCount}
      </span>
    </div>
  );
};

export const ReactionBar: React.FC<ReactionBarProps> = ({
  reactions,
  currentUserId,
  onReaction,
  size = 'md',
  className,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pickerButtonRef = useRef<HTMLButtonElement | null>(null);

  // Get user's current reactions
  const userReactions = currentUserId
    ? REACTION_TYPES.filter((type) => reactions[type]?.includes(currentUserId))
    : [];

  // Get reactions with counts > 0
  const activeReactions = REACTION_TYPES.filter(
    (type) => reactions[type]?.length > 0
  );

  // Check if user has reacted with a specific type
  const hasUserReacted = (type: ReactionType): boolean => {
    return userReactions.includes(type);
  };

  const handleReaction = async (type: ReactionType) => {
    if (!onReaction || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onReaction(type);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      {/* Existing reactions */}
      <div className="flex items-center gap-1 flex-wrap">
        {activeReactions.map((type) => (
          <ReactionButton
            key={type}
            type={type}
            count={reactions[type]?.length || 0}
            isActive={hasUserReacted(type)}
            onClick={() => handleReaction(type)}
            size={size}
            disabled={isSubmitting}
          />
        ))}
      </div>

      {/* Add reaction button */}
      {onReaction && (
        <div className="relative">
          <motion.button
            ref={pickerButtonRef}
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            disabled={isSubmitting}
            aria-label="Add reaction"
            className={cn(
              'flex items-center justify-center rounded-full transition-colors',
              'bg-bzr-gray-800/50 text-bzr-gray-400 hover:bg-bzr-gray-800 hover:text-bzr-white',
              size === 'sm' ? 'w-7 h-7' : 'w-8 h-8',
              isSubmitting && 'cursor-wait opacity-60'
            )}
            whileHover={isSubmitting ? {} : { scale: 1.1 }}
            whileTap={isSubmitting ? {} : { scale: 0.9 }}
          >
            <svg
              className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </motion.button>

          <EmojiPicker
            isOpen={pickerOpen}
            anchorRef={pickerButtonRef}
            onSelect={handleReaction}
            onClose={() => setPickerOpen(false)}
            activeReactions={userReactions}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  );
};

// Compact reaction display (for lists)
export const ReactionSummaryDisplay: React.FC<{
  reactions: Reactions;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ reactions, size = 'sm', className }) => (
  <div className={cn('flex items-center', className)}>
    <ReactionSummary reactions={reactions} size={size} />
  </div>
);

// Floating reaction animation (for when a user reacts)
export const ReactionFloatAnimation: React.FC<{
  emoji: string;
  onComplete?: () => void;
}> = ({ emoji, onComplete }) => (
  <motion.div
    className="fixed text-4xl pointer-events-none z-50"
    initial={{ y: 0, opacity: 1, scale: 0.5 }}
    animate={{
      y: -100,
      opacity: 0,
      scale: 1.5,
    }}
    transition={{ duration: 0.8, ease: 'easeOut' }}
    onAnimationComplete={onComplete}
  >
    {emoji}
  </motion.div>
);

export type { ReactionBarProps };
