'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Inspiration data pools
const THEMES = [
  'Nostalgia', 'Chaos', 'Silence', 'Metamorphosis', 'Dreams',
  'Boundaries', 'Decay', 'Growth', 'Identity', 'Time',
  'Memory', 'Connection', 'Isolation', 'Nature', 'Technology',
  'Home', 'Journey', 'Ritual', 'Shadow', 'Light',
  'Fragments', 'Layers', 'Tension', 'Balance', 'Contrast',
];

const MEDIUMS = [
  'Watercolor', 'Charcoal', 'Digital collage', 'Photography', 'Mixed media',
  'Ink', 'Acrylic', 'Found objects', 'Video', 'Sound',
  'Pencil', 'Oil pastel', 'Linocut', 'Embroidery', 'Clay',
  'Spray paint', 'Marker', 'Paper cutout', 'Wire', 'Fabric',
  'Light installation', 'Body paint', 'Ice', 'Nature materials', 'Recycled items',
];

const CONSTRAINTS = [
  'Use only one color', 'Complete in 30 minutes', 'Eyes closed for first draft',
  'Include text', 'No straight lines', 'Work with your non-dominant hand',
  'Create something tiny', 'Make it huge', 'Include a hidden element',
  'Use a childhood photo as reference', 'Incorporate a random object',
  'Work only at night', 'Create in silence', 'Listen to unfamiliar music',
  'Collaborate with someone', 'Start from the center', 'Work backwards',
  'Use only recycled materials', 'Create in public', 'Document the process',
  'Make it wearable', 'Create something ephemeral', 'Use shadows as medium',
  'Respond to a news headline', 'Reinterpret a classic artwork',
];

interface InspirationItem {
  theme: string;
  medium: string;
  constraint: string;
}

interface RandomInspirationProps {
  onShare?: (inspiration: InspirationItem) => void;
  className?: string;
}

// Slot machine reel component
const SlotReel: React.FC<{
  items: string[];
  currentIndex: number;
  isSpinning: boolean;
  label: string;
  accentColor: string;
}> = ({ items, currentIndex, isSpinning, label, accentColor }) => {
  return (
    <div className="flex-1 text-center">
      <span
        className="text-xs font-mono uppercase tracking-widest mb-2 block"
        style={{ color: accentColor }}
      >
        {label}
      </span>

      <div className="relative h-24 overflow-hidden rounded-xl bg-bzr-gray-800/50">
        {/* Gradient overlays for fade effect */}
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-bzr-gray-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bzr-gray-900 to-transparent z-10 pointer-events-none" />

        {/* Items container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isSpinning ? 'spinning' : currentIndex}
            className="flex flex-col items-center justify-center h-full px-3"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{
              duration: isSpinning ? 0.1 : 0.3,
              ease: isSpinning ? 'linear' : [0.22, 1, 0.36, 1],
            }}
          >
            <span className="font-display text-lg md:text-xl text-bzr-white text-center leading-tight">
              {items[currentIndex]}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Spinning overlay */}
        <AnimatePresence>
          {isSpinning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="flex-shrink-0 h-24 flex items-center justify-center px-3"
                  animate={{ y: [-96, 384] }}
                  transition={{
                    duration: 0.3,
                    delay: i * 0.05,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <span className="font-display text-lg text-bzr-gray-500 text-center">
                    {items[(currentIndex + i) % items.length]}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Card flip reveal alternative
const CardFlipReveal: React.FC<{
  value: string;
  label: string;
  isRevealing: boolean;
  accentColor: string;
  delay: number;
}> = ({ value, label, isRevealing, accentColor, delay }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  React.useEffect(() => {
    if (isRevealing) {
      setIsFlipped(false);
      const timer = setTimeout(() => setIsFlipped(true), delay);
      return () => clearTimeout(timer);
    }
  }, [isRevealing, delay]);

  return (
    <div className="flex-1 perspective-1000">
      <span
        className="text-xs font-mono uppercase tracking-widest mb-2 block text-center"
        style={{ color: accentColor }}
      >
        {label}
      </span>

      <motion.div
        className="relative h-32 cursor-pointer preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: isFlipped ? 0 : 0 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front (question mark) */}
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center backface-hidden"
          style={{
            backgroundColor: `${accentColor}20`,
            border: `2px solid ${accentColor}40`,
            backfaceVisibility: 'hidden',
          }}
        >
          <span className="text-4xl font-display" style={{ color: accentColor }}>?</span>
        </div>

        {/* Back (revealed value) */}
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center p-4 backface-hidden"
          style={{
            backgroundColor: `${accentColor}10`,
            border: `2px solid ${accentColor}`,
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
          }}
        >
          <span className="font-display text-lg text-bzr-white text-center leading-tight">
            {value}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export const RandomInspiration: React.FC<RandomInspirationProps> = ({
  onShare,
  className,
}) => {
  const [inspiration, setInspiration] = useState<InspirationItem>({
    theme: THEMES[0],
    medium: MEDIUMS[0],
    constraint: CONSTRAINTS[0],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [displayMode, setDisplayMode] = useState<'slot' | 'card'>('slot');

  // Random index generator
  const getRandomIndex = (array: string[]) => Math.floor(Math.random() * array.length);

  // Generate new inspiration
  const generate = useCallback(async () => {
    setIsGenerating(true);
    setHasGenerated(true);

    // Simulate slot machine spinning
    const spinDuration = 1500;
    const updateInterval = 80;
    const updates = spinDuration / updateInterval;

    for (let i = 0; i < updates; i++) {
      await new Promise((resolve) => setTimeout(resolve, updateInterval));
      setInspiration({
        theme: THEMES[getRandomIndex(THEMES)],
        medium: MEDIUMS[getRandomIndex(MEDIUMS)],
        constraint: CONSTRAINTS[getRandomIndex(CONSTRAINTS)],
      });
    }

    // Final values
    const final = {
      theme: THEMES[getRandomIndex(THEMES)],
      medium: MEDIUMS[getRandomIndex(MEDIUMS)],
      constraint: CONSTRAINTS[getRandomIndex(CONSTRAINTS)],
    };
    setInspiration(final);
    setIsGenerating(false);
  }, []);

  // Share inspiration
  const handleShare = useCallback(() => {
    if (onShare) {
      onShare(inspiration);
    } else {
      // Default share behavior using Web Share API
      const text = `My random art inspiration:\n\nTheme: ${inspiration.theme}\nMedium: ${inspiration.medium}\nConstraint: ${inspiration.constraint}\n\nGenerated by Club BZR`;

      if (navigator.share) {
        navigator.share({
          title: 'Random Art Inspiration',
          text,
        });
      } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(text);
      }
    }
  }, [inspiration, onShare]);

  // Copy to clipboard
  const copyToClipboard = () => {
    const text = `Theme: ${inspiration.theme}\nMedium: ${inspiration.medium}\nConstraint: ${inspiration.constraint}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      className={cn(
        'bg-bzr-gray-900 rounded-2xl p-6 border border-bzr-gray-800 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-xl text-bzr-white mb-1">
            Random Inspiration
          </h3>
          <p className="text-sm text-bzr-gray-400">
            Get a creative prompt to spark your next piece
          </p>
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-2 bg-bzr-gray-800 rounded-lg p-1">
          <button
            onClick={() => setDisplayMode('slot')}
            className={cn(
              'px-3 py-1 rounded text-xs font-mono transition-colors',
              displayMode === 'slot'
                ? 'bg-bzr-gray-700 text-bzr-white'
                : 'text-bzr-gray-400 hover:text-bzr-white'
            )}
          >
            Slots
          </button>
          <button
            onClick={() => setDisplayMode('card')}
            className={cn(
              'px-3 py-1 rounded text-xs font-mono transition-colors',
              displayMode === 'card'
                ? 'bg-bzr-gray-700 text-bzr-white'
                : 'text-bzr-gray-400 hover:text-bzr-white'
            )}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Slot machine display */}
      {displayMode === 'slot' && (
        <div className="flex gap-4 mb-6">
          <SlotReel
            items={THEMES}
            currentIndex={THEMES.indexOf(inspiration.theme)}
            isSpinning={isGenerating}
            label="Theme"
            accentColor="#CCFF00"
          />
          <SlotReel
            items={MEDIUMS}
            currentIndex={MEDIUMS.indexOf(inspiration.medium)}
            isSpinning={isGenerating}
            label="Medium"
            accentColor="#0066FF"
          />
          <SlotReel
            items={CONSTRAINTS}
            currentIndex={CONSTRAINTS.indexOf(inspiration.constraint)}
            isSpinning={isGenerating}
            label="Constraint"
            accentColor="#FF6B35"
          />
        </div>
      )}

      {/* Card flip display */}
      {displayMode === 'card' && (
        <div className="flex gap-4 mb-6">
          <CardFlipReveal
            value={inspiration.theme}
            label="Theme"
            isRevealing={isGenerating || !hasGenerated}
            accentColor="#CCFF00"
            delay={0}
          />
          <CardFlipReveal
            value={inspiration.medium}
            label="Medium"
            isRevealing={isGenerating || !hasGenerated}
            accentColor="#0066FF"
            delay={200}
          />
          <CardFlipReveal
            value={inspiration.constraint}
            label="Constraint"
            isRevealing={isGenerating || !hasGenerated}
            accentColor="#FF6B35"
            delay={400}
          />
        </div>
      )}

      {/* Generated prompt summary */}
      <AnimatePresence>
        {hasGenerated && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-xl bg-gradient-to-r from-bzr-green/10 via-bzr-blue/10 to-bzr-orange/10 border border-bzr-gray-700"
          >
            <p className="text-sm text-bzr-gray-300 font-mono">
              Create a piece about{' '}
              <span className="text-bzr-green font-bold">{inspiration.theme}</span>
              {' '}using{' '}
              <span className="text-bzr-blue font-bold">{inspiration.medium}</span>
              {' '}with the constraint:{' '}
              <span className="text-bzr-orange font-bold">{inspiration.constraint}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex gap-3">
        <motion.button
          onClick={generate}
          disabled={isGenerating}
          className={cn(
            'flex-1 px-6 py-3 rounded-xl font-display text-sm transition-all',
            'bg-bzr-green text-bzr-black hover:shadow-glow-green',
            isGenerating && 'opacity-70 cursor-wait'
          )}
          whileHover={!isGenerating ? { scale: 1.02 } : {}}
          whileTap={!isGenerating ? { scale: 0.98 } : {}}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="w-4 h-4 border-2 border-bzr-black/30 border-t-bzr-black rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Generating...
            </span>
          ) : hasGenerated ? (
            'Generate Again'
          ) : (
            'Generate Inspiration'
          )}
        </motion.button>

        {hasGenerated && !isGenerating && (
          <>
            <motion.button
              onClick={copyToClipboard}
              className="px-4 py-3 rounded-xl bg-bzr-gray-800 text-bzr-white hover:bg-bzr-gray-700 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="Copy to clipboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </motion.button>

            <motion.button
              onClick={handleShare}
              className="px-4 py-3 rounded-xl bg-bzr-gray-800 text-bzr-white hover:bg-bzr-gray-700 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="Share"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
};

export type { RandomInspirationProps, InspirationItem };
