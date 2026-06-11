'use client';

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Session, SessionType, SessionStatus } from '../../../../lib/schema';
import { Timestamp } from 'firebase/firestore';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface SessionCardProps {
  session: Session;
  onClick?: () => void;
  className?: string;
  featured?: boolean;
}

// Session type badge colors
const typeColors: Record<SessionType, string> = {
  workshop: 'bg-bzr-blue/20 text-bzr-blue border-bzr-blue/30',
  exhibition: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  open_studio: 'bg-bzr-orange/20 text-bzr-orange border-bzr-orange/30',
  critique: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  talk: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  collaboration: 'bg-bzr-lavender/20 text-bzr-lavender border-bzr-lavender/30',
  field_trip: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  social: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  online: 'bg-bzr-green/20 text-bzr-green border-bzr-green/30',
};

// Format date helper
const formatDate = (timestamp: Timestamp | Date): string => {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

// Format time helper
const formatTime = (timestamp: Timestamp | Date): string => {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Get registration status
const getRegistrationStatus = (session: Session): {
  label: string;
  color: string;
  isFull: boolean;
} => {
  const attendeeCount = session.attendees?.length || 0;
  const capacity = session.capacity || 0;
  const remaining = capacity - attendeeCount;
  const percentFull = capacity > 0 ? (attendeeCount / capacity) * 100 : 0;

  if (session.status === 'cancelled') {
    return { label: 'Cancelled', color: 'text-red-400', isFull: true };
  }
  if (session.status === 'completed') {
    return { label: 'Completed', color: 'text-bzr-gray-400', isFull: true };
  }
  if (remaining <= 0) {
    return { label: 'Full', color: 'text-bzr-orange', isFull: true };
  }
  if (remaining <= 3) {
    return { label: `${remaining} spots left`, color: 'text-bzr-orange', isFull: false };
  }
  if (percentFull >= 50) {
    return { label: `${remaining} spots left`, color: 'text-bzr-green', isFull: false };
  }
  return { label: 'Open', color: 'text-bzr-green', isFull: false };
};

// Capacity indicator component
const CapacityIndicator: React.FC<{ session: Session }> = ({ session }) => {
  const attendeeCount = session.attendees?.length || 0;
  const capacity = session.capacity || 0;
  const percentFull = capacity > 0 ? (attendeeCount / capacity) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bzr-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            percentFull >= 90 ? 'bg-bzr-orange' : percentFull >= 50 ? 'bg-bzr-blue' : 'bg-bzr-green'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentFull}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-bzr-gray-400">
        {attendeeCount}/{capacity}
      </span>
    </div>
  );
};

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onClick,
  className,
  featured = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Parallax effect for cover image
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const parallaxX = useTransform(mouseX, [-0.5, 0.5], [10, -10]);
  const parallaxY = useTransform(mouseY, [-0.5, 0.5], [10, -10]);

  const smoothParallaxX = useSpring(parallaxX, { damping: 50, stiffness: 200 });
  const smoothParallaxY = useSpring(parallaxY, { damping: 50, stiffness: 200 });

  // Handle mouse move for parallax
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const registrationStatus = getRegistrationStatus(session);
  const formatSessionType = (type: SessionType) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  // Check if session is in the past
  const sessionDate = session.date instanceof Timestamp ? session.date.toDate() : session.date;
  const isPast = sessionDate < new Date();

  return (
    <motion.article
      ref={cardRef}
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer',
        'bg-bzr-gray-900/80 backdrop-blur-sm',
        'border border-bzr-gray-800',
        featured && 'md:col-span-2',
        isPast && 'opacity-75',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        mouseX.set(0);
        mouseY.set(0);
      }}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Cover image with parallax */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {session.coverImage ? (
          <motion.div
            className="absolute inset-0"
            style={{
              x: smoothParallaxX,
              y: smoothParallaxY,
              scale: 1.1,
            }}
          >
            <img
              src={session.coverImage}
              alt={session.title}
              className={cn(
                'w-full h-full object-cover transition-transform duration-500',
                isHovered && 'scale-110'
              )}
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-bzr-gray-800 to-bzr-gray-900 flex items-center justify-center">
            <span className="text-6xl opacity-20">
              {session.type === 'online' ? '📡' : '🎨'}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bzr-black via-bzr-black/20 to-transparent" />

        {/* Date overlay */}
        <div className="absolute top-4 left-4">
          <div className="bg-bzr-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-center min-w-[60px]">
            <div className="text-xs text-bzr-gray-300 uppercase tracking-wider">
              {formatDate(session.date as Timestamp).split(',')[0]}
            </div>
            <div className="text-2xl font-display font-bold text-bzr-white">
              {((session.date as unknown as Timestamp | Date) instanceof Timestamp ? (session.date as Timestamp).toDate() : (session.date as unknown as Date)).getDate()}
            </div>
          </div>
        </div>

        {/* Status badge */}
        {(session.status === 'cancelled' || isPast) && (
          <div className="absolute top-4 right-4">
            <span
              className={cn(
                'px-3 py-1 text-xs font-mono uppercase rounded-full',
                session.status === 'cancelled'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-bzr-gray-700/80 text-bzr-gray-300'
              )}
            >
              {session.status === 'cancelled' ? 'Cancelled' : 'Past'}
            </span>
          </div>
        )}

        {/* Hover overlay with more info */}
        <motion.div
          className="absolute inset-0 bg-bzr-black/60 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <span className="px-4 py-2 bg-bzr-white text-bzr-black rounded-lg font-display text-sm">
              View Details
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Type badge and online indicator */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              'px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full border',
              typeColors[session.type]
            )}
          >
            {formatSessionType(session.type)}
          </span>
          {session.isOnline && (
            <span className="flex items-center gap-1 text-xs text-bzr-green">
              <span className="w-2 h-2 bg-bzr-green rounded-full animate-pulse" />
              Online
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display text-xl font-bold text-bzr-white mb-2 line-clamp-2">
          {session.title}
        </h3>

        {/* Time and location */}
        <div className="flex items-center gap-4 text-sm text-bzr-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(session.date as Timestamp)}
            {session.duration && (
              <span className="text-bzr-gray-500">
                ({Math.floor(session.duration / 60)}h)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 truncate">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">
              {session.isOnline ? 'Virtual Event' : session.location.name}
            </span>
          </div>
        </div>

        {/* Capacity indicator */}
        {!isPast && session.status !== 'cancelled' && (
          <div className="mb-4">
            <CapacityIndicator session={session} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-bzr-gray-800">
          {/* Facilitator */}
          <div className="flex items-center gap-2">
            {session.facilitator.photoURL ? (
              <img
                src={session.facilitator.photoURL}
                alt={session.facilitator.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-bzr-gray-700 flex items-center justify-center">
                <span className="text-xs text-bzr-gray-400">
                  {session.facilitator.name.charAt(0)}
                </span>
              </div>
            )}
            <span className="text-sm text-bzr-gray-400 truncate max-w-[120px]">
              {session.facilitator.name}
            </span>
          </div>

          {/* Registration status */}
          <span className={cn('text-sm font-mono', registrationStatus.color)}>
            {registrationStatus.label}
          </span>
        </div>

        {/* Price indicator */}
        {!session.isFree && session.price && (
          <div className="mt-3 text-right">
            <span className="text-sm font-mono text-bzr-green">
              {session.currency || '$'}{session.price}
            </span>
          </div>
        )}
      </div>

      {/* Featured glow */}
      {featured && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: isHovered
              ? '0 0 40px rgba(0, 102, 255, 0.3), inset 0 0 40px rgba(0, 102, 255, 0.05)'
              : '0 0 0 rgba(0, 102, 255, 0)',
          }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.article>
  );
};

// Skeleton loader
export const SessionCardSkeleton: React.FC<{ featured?: boolean; className?: string }> = ({
  featured = false,
  className,
}) => (
  <div
    className={cn(
      'rounded-2xl overflow-hidden bg-bzr-gray-900/80 border border-bzr-gray-800',
      featured && 'md:col-span-2',
      className
    )}
  >
    {/* Image skeleton */}
    <div className="aspect-[16/9] bg-bzr-gray-800 animate-pulse" />

    {/* Content skeleton */}
    <div className="p-5">
      <div className="h-6 w-24 bg-bzr-gray-800 rounded-full mb-3 animate-pulse" />
      <div className="h-7 w-3/4 bg-bzr-gray-800 rounded mb-2 animate-pulse" />
      <div className="h-5 w-1/2 bg-bzr-gray-800 rounded mb-4 animate-pulse" />
      <div className="h-2 w-full bg-bzr-gray-800 rounded mb-4 animate-pulse" />
      <div className="flex justify-between items-center pt-4 border-t border-bzr-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-bzr-gray-800 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-bzr-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-4 w-16 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

export type { SessionCardProps };
