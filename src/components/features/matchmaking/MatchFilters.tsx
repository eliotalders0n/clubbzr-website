'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ArtMedium } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface MatchFiltersProps {
  selectedMediums: ArtMedium[];
  selectedGoals: string[];
  onMediumsChange: (mediums: ArtMedium[]) => void;
  onGoalsChange: (goals: string[]) => void;
  className?: string;
}

const mediums: { value: ArtMedium; label: string }[] = [
  { value: 'painting', label: 'Painting' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'photography', label: 'Photography' },
  { value: 'digital', label: 'Digital' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'mixed_media', label: 'Mixed Media' },
  { value: 'installation', label: 'Installation' },
  { value: 'performance', label: 'Performance' },
  { value: 'video', label: 'Video' },
  { value: 'animation', label: 'Animation' },
  { value: 'textile', label: 'Textile' },
  { value: 'ceramics', label: 'Ceramics' },
  { value: 'printmaking', label: 'Printmaking' },
  { value: 'collage', label: 'Collage' },
  { value: 'street_art', label: 'Street Art' },
  { value: 'conceptual', label: 'Conceptual' },
];

const goals: string[] = [
  'Collaboration on projects',
  'Skill exchange',
  'Exhibition partners',
  'Critique buddies',
  'Studio sharing',
  'Creative accountability',
  'Mentorship',
  'Networking',
];

export const MatchFilters: React.FC<MatchFiltersProps> = ({
  selectedMediums,
  selectedGoals,
  onMediumsChange,
  onGoalsChange,
  className,
}) => {
  const [expandedSection, setExpandedSection] = useState<'mediums' | 'goals' | null>('mediums');

  const toggleMedium = (medium: ArtMedium) => {
    if (selectedMediums.includes(medium)) {
      onMediumsChange(selectedMediums.filter((m) => m !== medium));
    } else {
      onMediumsChange([...selectedMediums, medium]);
    }
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      onGoalsChange(selectedGoals.filter((g) => g !== goal));
    } else {
      onGoalsChange([...selectedGoals, goal]);
    }
  };

  const clearAll = () => {
    onMediumsChange([]);
    onGoalsChange([]);
  };

  const hasFilters = selectedMediums.length > 0 || selectedGoals.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-bzr-white">
          Filter Matches
        </h3>
        {hasFilters && (
          <motion.button
            onClick={clearAll}
            className="text-sm text-bzr-gray-400 hover:text-bzr-white transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Clear all
          </motion.button>
        )}
      </div>

      {/* Mediums Section */}
      <div className="rounded-xl bg-bzr-gray-900/50 border border-bzr-gray-800 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'mediums' ? null : 'mediums')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-bzr-white">
              Mediums
            </span>
            {selectedMediums.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-mono text-bzr-blue bg-bzr-blue/10 rounded-full">
                {selectedMediums.length}
              </span>
            )}
          </div>
          <motion.svg
            className="w-5 h-5 text-bzr-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            animate={{ rotate: expandedSection === 'mediums' ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>

        <AnimatePresence>
          {expandedSection === 'mediums' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  {mediums.map((medium) => (
                    <motion.button
                      key={medium.value}
                      onClick={() => toggleMedium(medium.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                        selectedMediums.includes(medium.value)
                          ? 'bg-bzr-blue text-bzr-white border-bzr-blue'
                          : 'bg-transparent text-bzr-gray-400 border-bzr-gray-700 hover:border-bzr-gray-500 hover:text-bzr-white'
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {medium.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Goals Section */}
      <div className="rounded-xl bg-bzr-gray-900/50 border border-bzr-gray-800 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'goals' ? null : 'goals')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-bzr-white">
              Collaboration Goals
            </span>
            {selectedGoals.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-mono text-bzr-green bg-bzr-green/10 rounded-full">
                {selectedGoals.length}
              </span>
            )}
          </div>
          <motion.svg
            className="w-5 h-5 text-bzr-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            animate={{ rotate: expandedSection === 'goals' ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>

        <AnimatePresence>
          {expandedSection === 'goals' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0">
                <div className="space-y-2">
                  {goals.map((goal) => (
                    <motion.button
                      key={goal}
                      onClick={() => toggleGoal(goal)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                        selectedGoals.includes(goal)
                          ? 'bg-bzr-green/10 text-bzr-green'
                          : 'text-bzr-gray-400 hover:bg-bzr-gray-800 hover:text-bzr-white'
                      )}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          selectedGoals.includes(goal)
                            ? 'bg-bzr-green border-bzr-green'
                            : 'border-bzr-gray-600'
                        )}
                      >
                        {selectedGoals.includes(goal) && (
                          <svg className="w-3 h-3 text-bzr-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {goal}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active filters summary */}
      {hasFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-bzr-gray-900/30 border border-bzr-gray-800"
        >
          <p className="text-xs font-mono uppercase tracking-wider text-bzr-gray-500 mb-2">
            Active Filters
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedMediums.map((medium) => (
              <span
                key={medium}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-bzr-blue bg-bzr-blue/10 rounded-full"
              >
                {mediums.find((m) => m.value === medium)?.label}
                <button
                  onClick={() => toggleMedium(medium)}
                  className="hover:text-bzr-white transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {selectedGoals.map((goal) => (
              <span
                key={goal}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-bzr-green bg-bzr-green/10 rounded-full"
              >
                {goal}
                <button
                  onClick={() => toggleGoal(goal)}
                  className="hover:text-bzr-white transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export type { MatchFiltersProps };
