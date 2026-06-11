'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Header } from './Header';
import { Footer } from './Footer';

// Simple type definitions for props
interface HeaderProps {
  activeLink?: string;
}
import { SmoothScrollProvider } from '../animations/SmoothScroll';

// Page transition types
type TransitionType = 'fade' | 'slide' | 'scale' | 'reveal' | 'none';

interface PageWrapperProps {
  children: ReactNode;
  /** Show header */
  showHeader?: boolean;
  /** Show footer */
  showFooter?: boolean;
  /** Header props */
  headerProps?: Partial<HeaderProps>;
  /** Footer props */
  footerProps?: Record<string, any>;
  /** Enable smooth scrolling */
  smoothScroll?: boolean;
  /** Page transition type */
  transition?: TransitionType;
  /** Show loading state */
  loading?: boolean;
  /** Loading component */
  loadingComponent?: ReactNode;
  /** Custom className for main content */
  className?: string;
  /** Background color/class */
  background?: 'dark' | 'light' | 'transparent';
  /** Minimum content height */
  minHeight?: string;
}

// Page transition variants
const pageVariants: Record<TransitionType, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    },
  },
  slide: {
    initial: { opacity: 0, y: 30 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      y: -30,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      scale: 1.02,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    },
  },
  reveal: {
    initial: { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
    animate: {
      opacity: 1,
      clipPath: 'inset(0 0 0% 0)',
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      clipPath: 'inset(100% 0 0 0)',
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

// Background mapping
const backgroundMap = {
  dark: 'bg-bzr-black',
  light: 'bg-bzr-white',
  transparent: 'bg-transparent',
};

// Default Loading Component
const DefaultLoading: React.FC = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bzr-black">
    <motion.div
      className="relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Animated logo or spinner */}
      <motion.div
        className="w-16 h-16 border-2 border-bzr-gray-800 rounded-full"
        style={{ borderTopColor: '#0066FF' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />

      {/* Loading text */}
      <motion.p
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-bzr-gray-400 whitespace-nowrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Loading...
      </motion.p>
    </motion.div>
  </div>
);

// Initial page load animation
const InitialLoadOverlay: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-bzr-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="font-display text-4xl md:text-6xl font-bold text-bzr-white tracking-tight">
          Club BZR
        </span>
      </motion.div>
    </motion.div>
  );
};

export const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  showHeader = true,
  showFooter = true,
  headerProps = {},
  footerProps = {},
  smoothScroll = true,
  transition = 'fade',
  loading = false,
  loadingComponent,
  className,
  background = 'dark',
  minHeight = '100vh',
}) => {
  const location = useLocation();
  const [initialLoad, setInitialLoad] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Handle initial load animation
  useEffect(() => {
    // Check if this is the first load (not a route change)
    const hasLoaded = sessionStorage.getItem('bzr-loaded');
    if (hasLoaded) {
      setInitialLoad(false);
      setIsReady(true);
    }
  }, []);

  const handleInitialLoadComplete = () => {
    sessionStorage.setItem('bzr-loaded', 'true');
    setInitialLoad(false);
    setIsReady(true);
  };

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const variants = pageVariants[transition];

  const content = (
    <div className={cn('flex flex-col', backgroundMap[background])} style={{ minHeight }}>
      {/* Header */}
      {showHeader && (
        <Header {...headerProps} />
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            {loadingComponent || <DefaultLoading />}
          </motion.div>
        ) : (
          <motion.main
            key={location.pathname}
            className={cn('flex-1', className)}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants}
          >
            {children}
          </motion.main>
        )}
      </AnimatePresence>

      {/* Footer */}
      {showFooter && <Footer {...footerProps} />}
    </div>
  );

  return (
    <>
      {/* Initial Load Overlay */}
      <AnimatePresence>
        {initialLoad && (
          <InitialLoadOverlay onComplete={handleInitialLoadComplete} />
        )}
      </AnimatePresence>

      {/* Page Content */}
      <AnimatePresence>
        {isReady && (
          smoothScroll ? (
            <SmoothScrollProvider>
              {content}
            </SmoothScrollProvider>
          ) : (
            content
          )
        )}
      </AnimatePresence>
    </>
  );
};

// Simpler page wrapper without header/footer for nested pages
interface SimplePageWrapperProps {
  children: ReactNode;
  transition?: TransitionType;
  className?: string;
}

export const SimplePageWrapper: React.FC<SimplePageWrapperProps> = ({
  children,
  transition = 'fade',
  className,
}) => {
  const location = useLocation();
  const variants = pageVariants[transition];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className={className}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Dashboard layout wrapper with sidebar
interface DashboardLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header?: ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  sidebar,
  header,
  className,
}) => {
  return (
    <div className="flex min-h-screen bg-bzr-black">
      {/* Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        {sidebar}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Optional Header */}
        {header && (
          <div className="flex-shrink-0 border-b border-bzr-gray-800">
            {header}
          </div>
        )}

        {/* Content */}
        <main className={cn('flex-1 overflow-auto', className)}>
          {children}
        </main>
      </div>
    </div>
  );
};

export type {
  PageWrapperProps,
  SimplePageWrapperProps,
  DashboardLayoutProps,
  TransitionType,
};
