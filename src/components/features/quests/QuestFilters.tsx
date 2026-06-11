'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { QuestCategory, QuestDifficulty } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Sort options
type SortOption = 'newest' | 'oldest' | 'popular' | 'ending_soon';

interface QuestFiltersProps {
  selectedCategories: QuestCategory[];
  selectedDifficulties: QuestDifficulty[];
  sortBy: SortOption;
  onCategoryChange: (categories: QuestCategory[]) => void;
  onDifficultyChange: (difficulties: QuestDifficulty[]) => void;
  onSortChange: (sort: SortOption) => void;
  onClearAll: () => void;
  className?: string;
}

// All category options
const CATEGORIES: { value: QuestCategory; label: string }[] = [
  { value: 'daily_prompt', label: 'Daily Prompt' },
  { value: 'weekly_challenge', label: 'Weekly Challenge' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'skill_building', label: 'Skill Building' },
  { value: 'community', label: 'Community' },
  { value: 'experimental', label: 'Experimental' },
];

// All difficulty options
const DIFFICULTIES: { value: QuestDifficulty; label: string }[] = [
  { value: 'any', label: 'Any Level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

// Sort options
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'ending_soon', label: 'Ending Soon' },
];

// Filter section component
const FilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ title, children, isOpen, onToggle }) => (
  <div className="border-b border-bzr-gray-800 last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 text-left"
    >
      <span className="text-sm font-display text-bzr-white">{title}</span>
      <motion.svg
        className="w-4 h-4 text-bzr-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </motion.svg>
    </button>

    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="pb-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// Checkbox/Toggle item
const FilterItem: React.FC<{
  label: string;
  isSelected: boolean;
  onChange: () => void;
}> = ({ label, isSelected, onChange }) => (
  <motion.button
    onClick={onChange}
    className={cn(
      'flex items-center gap-3 w-full py-2 px-3 rounded-lg text-left transition-colors',
      isSelected ? 'bg-bzr-gray-800' : 'hover:bg-bzr-gray-800/50'
    )}
    whileTap={{ scale: 0.98 }}
  >
    <motion.div
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center',
        isSelected ? 'bg-bzr-green border-bzr-green' : 'border-bzr-gray-600'
      )}
      animate={{
        scale: isSelected ? [1, 1.1, 1] : 1,
      }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence>
        {isSelected && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="w-3 h-3 text-bzr-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.div>
    <span className={cn('text-sm', isSelected ? 'text-bzr-white' : 'text-bzr-gray-400')}>
      {label}
    </span>
  </motion.button>
);

// Active filter pill
const FilterPill: React.FC<{
  label: string;
  onRemove: () => void;
}> = ({ label, onRemove }) => (
  <motion.span
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.8, opacity: 0 }}
    className="inline-flex items-center gap-1 px-3 py-1 bg-bzr-green/20 text-bzr-green rounded-full text-xs font-mono"
  >
    {label}
    <button
      onClick={onRemove}
      className="ml-1 hover:text-bzr-white transition-colors"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </motion.span>
);

export const QuestFilters: React.FC<QuestFiltersProps> = ({
  selectedCategories,
  selectedDifficulties,
  sortBy,
  onCategoryChange,
  onDifficultyChange,
  onSortChange,
  onClearAll,
  className,
}) => {
  const [openSections, setOpenSections] = useState({
    category: true,
    difficulty: true,
    sort: false,
  });

  // Toggle section
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Toggle category selection
  const toggleCategory = (category: QuestCategory) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoryChange([...selectedCategories, category]);
    }
  };

  // Toggle difficulty selection
  const toggleDifficulty = (difficulty: QuestDifficulty) => {
    if (selectedDifficulties.includes(difficulty)) {
      onDifficultyChange(selectedDifficulties.filter((d) => d !== difficulty));
    } else {
      onDifficultyChange([...selectedDifficulties, difficulty]);
    }
  };

  // Count active filters
  const activeFilterCount = selectedCategories.length + selectedDifficulties.length;

  // Get labels for active filters
  const getFilterLabel = (value: string) => {
    const category = CATEGORIES.find((c) => c.value === value);
    if (category) return category.label;
    const difficulty = DIFFICULTIES.find((d) => d.value === value);
    if (difficulty) return difficulty.label;
    return value;
  };

  return (
    <div className={cn('bg-bzr-gray-900 rounded-2xl p-4 border border-bzr-gray-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-bzr-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-bzr-green text-bzr-black rounded-full font-bold">
              {activeFilterCount}
            </span>
          )}
        </h3>

        {activeFilterCount > 0 && (
          <motion.button
            onClick={onClearAll}
            className="text-xs text-bzr-gray-400 hover:text-bzr-white transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear all
          </motion.button>
        )}
      </div>

      {/* Active filter pills */}
      <AnimatePresence>
        {activeFilterCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map((cat) => (
                <FilterPill
                  key={cat}
                  label={getFilterLabel(cat)}
                  onRemove={() => toggleCategory(cat)}
                />
              ))}
              {selectedDifficulties.map((diff) => (
                <FilterPill
                  key={diff}
                  label={getFilterLabel(diff)}
                  onRemove={() => toggleDifficulty(diff)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter sections */}
      <div className="space-y-1">
        {/* Category filter */}
        <FilterSection
          title="Category"
          isOpen={openSections.category}
          onToggle={() => toggleSection('category')}
        >
          <div className="space-y-1">
            {CATEGORIES.map((category) => (
              <FilterItem
                key={category.value}
                label={category.label}
                isSelected={selectedCategories.includes(category.value)}
                onChange={() => toggleCategory(category.value)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Difficulty filter */}
        <FilterSection
          title="Difficulty"
          isOpen={openSections.difficulty}
          onToggle={() => toggleSection('difficulty')}
        >
          <div className="space-y-1">
            {DIFFICULTIES.map((difficulty) => (
              <FilterItem
                key={difficulty.value}
                label={difficulty.label}
                isSelected={selectedDifficulties.includes(difficulty.value)}
                onChange={() => toggleDifficulty(difficulty.value)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Sort options */}
        <FilterSection
          title="Sort By"
          isOpen={openSections.sort}
          onToggle={() => toggleSection('sort')}
        >
          <div className="space-y-1">
            {SORT_OPTIONS.map((option) => (
              <motion.button
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={cn(
                  'flex items-center gap-3 w-full py-2 px-3 rounded-lg text-left transition-colors',
                  sortBy === option.value ? 'bg-bzr-blue/20' : 'hover:bg-bzr-gray-800/50'
                )}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    sortBy === option.value ? 'border-bzr-blue' : 'border-bzr-gray-600'
                  )}
                >
                  {sortBy === option.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 rounded-full bg-bzr-blue"
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm',
                    sortBy === option.value ? 'text-bzr-blue' : 'text-bzr-gray-400'
                  )}
                >
                  {option.label}
                </span>
              </motion.button>
            ))}
          </div>
        </FilterSection>
      </div>
    </div>
  );
};

// Mobile-friendly filter bar (horizontal scrolling pills)
export const QuestFilterBar: React.FC<{
  selectedCategories: QuestCategory[];
  onCategoryChange: (categories: QuestCategory[]) => void;
  className?: string;
}> = ({ selectedCategories, onCategoryChange, className }) => {
  const toggleCategory = (category: QuestCategory) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoryChange([...selectedCategories, category]);
    }
  };

  return (
    <div className={cn('overflow-x-auto scrollbar-hide', className)}>
      <div className="flex gap-2 pb-2">
        <motion.button
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono transition-colors',
            selectedCategories.length === 0
              ? 'bg-bzr-white text-bzr-black'
              : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white'
          )}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCategoryChange([])}
        >
          All
        </motion.button>

        {CATEGORIES.map((category) => (
          <motion.button
            key={category.value}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono transition-colors',
              selectedCategories.includes(category.value)
                ? 'bg-bzr-green text-bzr-black'
                : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white'
            )}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleCategory(category.value)}
          >
            {category.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export type { QuestFiltersProps, SortOption };
