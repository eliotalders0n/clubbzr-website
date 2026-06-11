'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Session, SessionType } from '../../../../lib/schema';
import { Timestamp } from 'firebase/firestore';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface SessionCalendarProps {
  sessions: Session[];
  onDateClick?: (date: Date, sessions: Session[]) => void;
  onSessionClick?: (session: Session) => void;
  className?: string;
}

// Days of the week
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Months
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Session type dot colors
const typeDotColors: Record<SessionType, string> = {
  workshop: 'bg-bzr-blue',
  exhibition: 'bg-purple-500',
  open_studio: 'bg-bzr-orange',
  critique: 'bg-amber-500',
  talk: 'bg-cyan-500',
  collaboration: 'bg-bzr-lavender',
  field_trip: 'bg-emerald-500',
  social: 'bg-pink-500',
  online: 'bg-bzr-green',
};

// Get days in month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// Get first day of month (0 = Sunday)
const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

// Check if same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Event dot component
const EventDot: React.FC<{ type: SessionType; size?: 'sm' | 'md' }> = ({
  type,
  size = 'sm',
}) => (
  <motion.div
    className={cn(
      'rounded-full',
      typeDotColors[type],
      size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
    )}
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: 'spring', stiffness: 500 }}
  />
);

// Calendar day component
const CalendarDay: React.FC<{
  date: Date;
  sessions: Session[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ date, sessions, isCurrentMonth, isToday, isSelected, onClick }) => {
  const hasSessions = sessions.length > 0;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'relative aspect-square flex flex-col items-center justify-center rounded-lg transition-colors',
        isCurrentMonth ? 'text-bzr-white' : 'text-bzr-gray-600',
        isToday && 'ring-2 ring-bzr-blue',
        isSelected && 'bg-bzr-blue text-bzr-white',
        !isSelected && hasSessions && 'hover:bg-bzr-gray-800',
        !isSelected && !hasSessions && 'hover:bg-bzr-gray-800/50'
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className={cn('text-sm font-mono', isToday && !isSelected && 'text-bzr-blue')}>
        {date.getDate()}
      </span>

      {/* Event dots */}
      {hasSessions && (
        <div className="flex gap-0.5 mt-1">
          {sessions.slice(0, 3).map((session, i) => (
            <EventDot key={session.id + i} type={session.type} />
          ))}
          {sessions.length > 3 && (
            <span className="text-[8px] text-bzr-gray-400 ml-0.5">
              +{sessions.length - 3}
            </span>
          )}
        </div>
      )}
    </motion.button>
  );
};

// Mini session card for popover
const MiniSessionCard: React.FC<{
  session: Session;
  onClick: () => void;
}> = ({ session, onClick }) => {
  const formatTime = (timestamp: Timestamp | Date): string => {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-bzr-gray-800/50 hover:bg-bzr-gray-800 transition-colors"
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-2">
        <EventDot type={session.type} size="md" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-bzr-white truncate">
            {session.title}
          </h4>
          <p className="text-xs text-bzr-gray-400">
            {formatTime(session.date as Timestamp)}
            {session.location && (
              <span> - {session.isOnline ? 'Online' : session.location.name}</span>
            )}
          </p>
        </div>
      </div>
    </motion.button>
  );
};

export const SessionCalendar: React.FC<SessionCalendarProps> = ({
  sessions,
  onDateClick,
  onSessionClick,
  className,
}) => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get sessions mapped by date string
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();

    sessions.forEach((session) => {
      const sessionDate = session.date as Timestamp | Date;
      const date = sessionDate instanceof Timestamp ? sessionDate.toDate() : sessionDate;
      const key = date.toISOString().split('T')[0];
      const existing = map.get(key) || [];
      map.set(key, [...existing, session]);
    });

    return map;
  }, [sessions]);

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date): Session[] => {
    const key = date.toISOString().split('T')[0];
    return sessionsByDate.get(key) || [];
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  // Handle day click
  const handleDayClick = (date: Date) => {
    const daySessions = getSessionsForDate(date);
    setSelectedDate(date);
    onDateClick?.(date, daySessions);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month's days
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(prevYear, prevMonth, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month's days (to fill the grid)
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(nextYear, nextMonth, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Selected date sessions
  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  return (
    <div className={cn('bg-bzr-gray-900 rounded-2xl border border-bzr-gray-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bzr-gray-800">
        <div className="flex items-center gap-2">
          <motion.button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>

          <h2 className="font-display text-lg text-bzr-white min-w-[160px] text-center">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>

          <motion.button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-bzr-gray-800 text-bzr-gray-400 hover:text-bzr-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>

        <motion.button
          onClick={goToToday}
          className="px-3 py-1 text-sm font-mono text-bzr-blue hover:bg-bzr-blue/10 rounded-lg transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Today
        </motion.button>
      </div>

      {/* Calendar body */}
      <div className="p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-mono text-bzr-gray-500 uppercase py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ date, isCurrentMonth }, index) => (
            <CalendarDay
              key={index}
              date={date}
              sessions={getSessionsForDate(date)}
              isCurrentMonth={isCurrentMonth}
              isToday={isSameDay(date, today)}
              isSelected={selectedDate ? isSameDay(date, selectedDate) : false}
              onClick={() => handleDayClick(date)}
            />
          ))}
        </div>
      </div>

      {/* Selected date sessions */}
      <AnimatePresence>
        {selectedDate && selectedDateSessions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-bzr-gray-800 overflow-hidden"
          >
            <div className="p-4">
              <h3 className="text-sm font-mono text-bzr-gray-400 mb-3">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedDateSessions.map((session) => (
                  <MiniSessionCard
                    key={session.id}
                    session={session}
                    onClick={() => onSessionClick?.(session)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="p-4 border-t border-bzr-gray-800">
        <div className="flex flex-wrap gap-3 text-xs text-bzr-gray-400">
          {Object.entries(typeDotColors).slice(0, 5).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={cn('w-2 h-2 rounded-full', color)} />
              <span className="capitalize">{type.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export type { SessionCalendarProps };
