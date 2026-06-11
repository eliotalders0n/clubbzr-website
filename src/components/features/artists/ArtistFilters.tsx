'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ArtMedium } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Availability filter options
type AvailabilityFilter = 'any' | 'collaborations' | 'commissions' | 'events';

// Collaboration goal options
type CollaborationGoal =
  | 'skill_share'
  | 'project_partner'
  | 'mentorship'
  | 'exhibition'
  | 'networking'
  | 'community';

interface ArtistFiltersProps {
  selectedMediums: ArtMedium[];
  availabilityFilter: AvailabilityFilter;
  selectedGoals: CollaborationGoal[];
  onMediumsChange: (mediums: ArtMedium[]) => void;
  onAvailabilityChange: (availability: AvailabilityFilter) => void;
  onGoalsChange: (goals: CollaborationGoal[]) => void;
  onClearAll: () => void;
  className?: string;
}

// All medium options
const MEDIUMS: { value: ArtMedium; label: string }[] = [
  { value: 'painting', label: 'Painting' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'photography', label: 'Photography' },
  { value: 'digital', label: 'Digital Art' },
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
  { value: 'other', label: 'Other' },
];

// Availability options
const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
  { value: 'any', label: 'Any Status' },
  { value: 'collaborations', label: 'Open to Collaborate' },
  { value: 'commissions', label: 'Taking Commissions' },
  { value: 'events', label: 'Available for Events' },
];

// Collaboration goals
const COLLABORATION_GOALS: { value: CollaborationGoal; label: string }[] = [
  { value: 'skill_share', label: 'Skill Sharing' },
  { value: 'project_partner', label: 'Project Partner' },
  { value: 'mentorship', label: 'Mentorship' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'networking', label: 'Networking' },
  { value: 'community', label: 'Community' },
];

// Animated pill component
const FilterPill: React.FC<{
  label: string;
  isSelected: boolean;
  onClick: () => void;
  color?: 'default' | 'green' | 'blue' | 'lavender';
}> = ({ label, isSelected, onClick, color = 'default' }) => {
  const colorClasses = {
    default: isSelected
      ? 'bg-bzr-white text-bzr-black'
      : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white hover:bg-bzr-gray-700',
    green: isSelected
      ? 'bg-bzr-green text-bzr-black'
      : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-green hover:bg-bzr-green/10',
    blue: isSelected
      ? 'bg-bzr-blue text-bzr-white'
      : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-blue hover:bg-bzr-blue/10',
    lavender: isSelected
      ? 'bg-bzr-lavender text-bzr-black'
      : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-lavender hover:bg-bzr-lavender/10',
  };

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-mono transition-colors',
        colorClasses[color]
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      layout
    >
      {label}
    </motion.button>
  );
};

// Filter section component
const FilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
  badge?: number;
}> = ({ title, children, badge }) => (
  <div className="mb-6 last:mb-0">
    <h4 className="text-xs font-mono uppercase tracking-wider text-bzr-gray-500 mb-3 flex items-center gap-2">
      {title}
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-bzr-green text-bzr-black rounded-full">
          {badge}
        </span>
      )}
    </h4>
    {children}
  </div>
);

// Active filter tag
const ActiveFilterTag: React.FC<{
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
    <button onClick={onRemove} className="ml-1 hover:text-bzr-white transition-colors">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </motion.span>
);

export const ArtistFilters: React.FC<ArtistFiltersProps> = ({
  selectedMediums,
  availabilityFilter,
  selectedGoals,
  onMediumsChange,
  onAvailabilityChange,
  onGoalsChange,
  onClearAll,
  className,
}) => {
  const [expandedMediums, setExpandedMediums] = useState(false);

  // Toggle medium selection
  const toggleMedium = (medium: ArtMedium) => {
    if (selectedMediums.includes(medium)) {
      onMediumsChange(selectedMediums.filter((m) => m !== medium));
    } else {
      onMediumsChange([...selectedMediums, medium]);
    }
  };

  // Toggle goal selection
  const toggleGoal = (goal: CollaborationGoal) => {
    if (selectedGoals.includes(goal)) {
      onGoalsChange(selectedGoals.filter((g) => g !== goal));
    } else {
      onGoalsChange([...selectedGoals, goal]);
    }
  };

  // Count active filters
  const activeFilterCount =
    selectedMediums.length +
    (availabilityFilter !== 'any' ? 1 : 0) +
    selectedGoals.length;

  // Get label for medium
  const getMediumLabel = (value: ArtMedium) =>
    MEDIUMS.find((m) => m.value === value)?.label || value;

  // Get label for goal
  const getGoalLabel = (value: CollaborationGoal) =>
    COLLABORATION_GOALS.find((g) => g.value === value)?.label || value;

  // Mediums to show (limited unless expanded)
  const visibleMediums = expandedMediums ? MEDIUMS : MEDIUMS.slice(0, 8);

  return (
    <div className={cn('bg-bzr-gray-900 rounded-2xl p-5 border border-bzr-gray-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg text-bzr-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
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

      {/* Active filters tags */}
      <AnimatePresence>
        {activeFilterCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-5"
          >
            <div className="flex flex-wrap gap-2">
              {selectedMediums.map((medium) => (
                <ActiveFilterTag
                  key={medium}
                  label={getMediumLabel(medium)}
                  onRemove={() => toggleMedium(medium)}
                />
              ))}
              {availabilityFilter !== 'any' && (
                <ActiveFilterTag
                  label={AVAILABILITY_OPTIONS.find((o) => o.value === availabilityFilter)?.label || ''}
                  onRemove={() => onAvailabilityChange('any')}
                />
              )}
              {selectedGoals.map((goal) => (
                <ActiveFilterTag
                  key={goal}
                  label={getGoalLabel(goal)}
                  onRemove={() => toggleGoal(goal)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Medium filter */}
      <FilterSection title="Medium" badge={selectedMediums.length}>
        <div className="flex flex-wrap gap-2">
          {visibleMediums.map(({ value, label }) => (
            <FilterPill
              key={value}
              label={label}
              isSelected={selectedMediums.includes(value)}
              onClick={() => toggleMedium(value)}
            />
          ))}
        </div>

        {MEDIUMS.length > 8 && (
          <motion.button
            onClick={() => setExpandedMediums(!expandedMediums)}
            className="mt-3 text-xs text-bzr-blue hover:text-bzr-blue/80 transition-colors"
            whileHover={{ x: expandedMediums ? 0 : 4 }}
          >
            {expandedMediums ? 'Show less' : `+ ${MEDIUMS.length - 8} more`}
          </motion.button>
        )}
      </FilterSection>

      {/* Availability filter */}
      <FilterSection title="Availability">
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map(({ value, label }) => (
            <FilterPill
              key={value}
              label={label}
              isSelected={availabilityFilter === value}
              onClick={() => onAvailabilityChange(value)}
              color="green"
            />
          ))}
        </div>
      </FilterSection>

      {/* Collaboration goals filter */}
      <FilterSection title="Looking for" badge={selectedGoals.length}>
        <div className="flex flex-wrap gap-2">
          {COLLABORATION_GOALS.map(({ value, label }) => (
            <FilterPill
              key={value}
              label={label}
              isSelected={selectedGoals.includes(value)}
              onClick={() => toggleGoal(value)}
              color="lavender"
            />
          ))}
        </div>
      </FilterSection>
    </div>
  );
};

// Horizontal scrolling filter bar for mobile
export const ArtistFilterBar: React.FC<{
  selectedMediums: ArtMedium[];
  onMediumsChange: (mediums: ArtMedium[]) => void;
  className?: string;
}> = ({ selectedMediums, onMediumsChange, className }) => {
  const toggleMedium = (medium: ArtMedium) => {
    if (selectedMediums.includes(medium)) {
      onMediumsChange(selectedMediums.filter((m) => m !== medium));
    } else {
      onMediumsChange([...selectedMediums, medium]);
    }
  };

  return (
    <div className={cn('overflow-x-auto scrollbar-hide', className)}>
      <div className="flex gap-2 pb-2">
        <motion.button
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono transition-colors',
            selectedMediums.length === 0
              ? 'bg-bzr-white text-bzr-black'
              : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white'
          )}
          whileTap={{ scale: 0.95 }}
          onClick={() => onMediumsChange([])}
        >
          All Mediums
        </motion.button>

        {MEDIUMS.slice(0, 10).map(({ value, label }) => (
          <motion.button
            key={value}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono transition-colors',
              selectedMediums.includes(value)
                ? 'bg-bzr-green text-bzr-black'
                : 'bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white'
            )}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleMedium(value)}
          >
            {label}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export type { ArtistFiltersProps, AvailabilityFilter, CollaborationGoal };
