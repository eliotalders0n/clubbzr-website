'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface PromptCardProps {
  prompt: string;
  postCount: number;
  onRespond?: () => void;
  featured?: boolean;
  className?: string;
}

// Artistic typography treatment
const ArtisticText: React.FC<{
  text: string;
  isHovered: boolean;
}> = ({ text, isHovered }) => {
  const words = text.split(' ');

  return (
    <span className="inline">
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block mr-[0.3em]">
          {word.split('').map((char, charIndex) => (
            <motion.span
              key={charIndex}
              className="inline-block"
              style={{
                fontFamily:
                  charIndex % 3 === 0
                    ? 'Space Grotesk'
                    : charIndex % 3 === 1
                      ? 'Inter'
                      : 'JetBrains Mono',
              }}
              animate={{
                y: isHovered ? Math.sin((wordIndex + charIndex) * 0.5) * 3 : 0,
                rotate: isHovered ? Math.cos((wordIndex + charIndex) * 0.5) * 2 : 0,
                scale: isHovered ? 1 + Math.sin((wordIndex + charIndex) * 0.3) * 0.1 : 1,
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: (wordIndex + charIndex) * 0.02,
              }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
};

export const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  postCount,
  onRespond,
  featured = false,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.article
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer',
        'bg-gradient-to-br from-bzr-gray-900 via-bzr-gray-900 to-bzr-gray-800',
        'border border-bzr-gray-800',
        featured && 'border-bzr-lavender/30',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onRespond}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-bzr-lavender/20 via-transparent to-bzr-blue/10"
        animate={{
          opacity: isHovered ? 0.8 : 0.3,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Content */}
      <div className="relative z-10 p-6">
        {/* Featured badge */}
        {featured && (
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="px-3 py-1 text-xs font-mono uppercase tracking-wider bg-bzr-lavender/20 text-bzr-lavender rounded-full">
              Featured Prompt
            </span>
          </motion.div>
        )}

        {/* Prompt text with artistic typography */}
        <blockquote className="mb-6">
          <span className="text-5xl text-bzr-lavender/40 font-serif leading-none">&ldquo;</span>
          <p
            className={cn(
              'font-display text-bzr-white leading-relaxed',
              featured ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
            )}
          >
            <ArtisticText text={prompt} isHovered={isHovered} />
          </p>
          <span className="text-5xl text-bzr-lavender/40 font-serif leading-none">&rdquo;</span>
        </blockquote>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Post count */}
          <div className="flex items-center gap-2 text-bzr-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
              />
            </svg>
            <span className="text-sm font-mono">
              {postCount} {postCount === 1 ? 'response' : 'responses'}
            </span>
          </div>

          {/* CTA button */}
          <motion.span
            className={cn(
              'px-4 py-2 rounded-lg font-display text-sm transition-all',
              'bg-bzr-lavender text-bzr-black',
              'group-hover:shadow-[0_0_20px_rgba(230,230,250,0.3)]'
            )}
            animate={{
              scale: isHovered ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            Respond
          </motion.span>
        </div>
      </div>

      {/* Animated border on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          boxShadow: isHovered
            ? 'inset 0 0 0 2px rgba(230, 230, 250, 0.3), 0 0 30px rgba(230, 230, 250, 0.15)'
            : 'inset 0 0 0 1px rgba(38, 38, 38, 1)',
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.article>
  );
};

// Prompt list component for displaying multiple prompts
export const PromptList: React.FC<{
  prompts: Array<{ prompt: string; postCount: number; featured?: boolean }>;
  onRespond?: (prompt: string) => void;
  className?: string;
}> = ({ prompts, onRespond, className }) => (
  <div className={cn('space-y-4', className)}>
    {prompts.map((item, index) => (
      <PromptCard
        key={index}
        prompt={item.prompt}
        postCount={item.postCount}
        featured={item.featured}
        onRespond={() => onRespond?.(item.prompt)}
      />
    ))}
  </div>
);

// Mini prompt card for compact displays
export const MiniPromptCard: React.FC<{
  prompt: string;
  postCount: number;
  onClick?: () => void;
  className?: string;
}> = ({ prompt, postCount, onClick, className }) => (
  <motion.button
    onClick={onClick}
    className={cn(
      'w-full text-left p-4 rounded-xl bg-bzr-gray-900/80 border border-bzr-gray-800',
      'hover:border-bzr-lavender/30 transition-colors',
      className
    )}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <p className="text-bzr-white font-display text-sm line-clamp-2 mb-2">
      &ldquo;{prompt}&rdquo;
    </p>
    <span className="text-xs text-bzr-gray-500 font-mono">
      {postCount} responses
    </span>
  </motion.button>
);

export type { PromptCardProps };
