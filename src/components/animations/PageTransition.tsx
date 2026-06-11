'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { gsap } from 'gsap';

// Direction type for transitions
type TransitionDirection = 'left' | 'right' | 'up' | 'down' | 'center';

// Transition type
type TransitionType = 'slide' | 'fade' | 'wipe' | 'reveal' | 'curtain' | 'morph';

// Context interface
interface PageTransitionContextType {
  isTransitioning: boolean;
  startTransition: (
    direction?: TransitionDirection,
    type?: TransitionType,
    callback?: () => void
  ) => void;
  setTransitionColor: (color: string) => void;
}

// Create context
const PageTransitionContext = createContext<PageTransitionContextType | null>(null);

// Hook to use page transition
export const usePageTransition = () => {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider');
  }
  return context;
};

// Props for provider
interface PageTransitionProviderProps {
  children: ReactNode;
  defaultColor?: string;
  duration?: number;
}

export const PageTransitionProvider: React.FC<PageTransitionProviderProps> = ({
  children,
  defaultColor = '#000000',
  duration = 1,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>('center');
  const [transitionType, setTransitionType] = useState<TransitionType>('reveal');
  const [transitionColor, setTransitionColor] = useState(defaultColor);

  const overlayRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement[]>([]);
  const callbackRef = useRef<(() => void) | null>(null);

  const startTransition = useCallback(
    (
      direction: TransitionDirection = 'center',
      type: TransitionType = 'reveal',
      callback?: () => void
    ) => {
      if (isTransitioning) return;

      setTransitionDirection(direction);
      setTransitionType(type);
      setIsTransitioning(true);
      callbackRef.current = callback || null;
    },
    [isTransitioning]
  );

  // GSAP-based animations
  useEffect(() => {
    if (!isTransitioning || !overlayRef.current) return;

    const overlay = overlayRef.current;
    const blocks = blocksRef.current;
    const tl = gsap.timeline({
      onComplete: () => {
        // Execute callback at midpoint
        if (callbackRef.current) {
          callbackRef.current();
        }

        // Reverse animation
        gsap.timeline().to(overlay, {
          opacity: 0,
          duration: duration * 0.5,
          ease: 'power3.inOut',
          onComplete: () => {
            setIsTransitioning(false);
          },
        });
      },
    });

    switch (transitionType) {
      case 'wipe':
        tl.fromTo(
          overlay,
          {
            clipPath: getWipeStart(transitionDirection),
            opacity: 1,
          },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: duration * 0.5,
            ease: 'power3.inOut',
          }
        );
        break;

      case 'curtain':
        // Split into blocks for curtain effect
        if (blocks.length > 0) {
          tl.fromTo(
            blocks,
            {
              scaleY: 0,
              transformOrigin:
                transitionDirection === 'up' ? 'bottom' : 'top',
            },
            {
              scaleY: 1,
              duration: duration * 0.5,
              stagger: 0.05,
              ease: 'power3.inOut',
            }
          );
        }
        break;

      case 'morph':
        tl.fromTo(
          overlay,
          {
            clipPath: 'circle(0% at 50% 50%)',
            opacity: 1,
          },
          {
            clipPath: 'circle(150% at 50% 50%)',
            duration: duration * 0.6,
            ease: 'power2.inOut',
          }
        );
        break;

      case 'reveal':
      default:
        tl.fromTo(
          overlay,
          {
            y: transitionDirection === 'up' ? '100%' : '-100%',
            opacity: 1,
          },
          {
            y: '0%',
            duration: duration * 0.5,
            ease: 'power3.inOut',
          }
        );
        break;
    }

    return () => {
      tl.kill();
    };
  }, [isTransitioning, transitionDirection, transitionType, duration]);

  // Helper to get clip path start for wipe effect
  const getWipeStart = (direction: TransitionDirection): string => {
    switch (direction) {
      case 'left':
        return 'inset(0% 100% 0% 0%)';
      case 'right':
        return 'inset(0% 0% 0% 100%)';
      case 'up':
        return 'inset(100% 0% 0% 0%)';
      case 'down':
        return 'inset(0% 0% 100% 0%)';
      default:
        return 'inset(50% 50% 50% 50%)';
    }
  };

  const contextValue: PageTransitionContextType = {
    isTransitioning,
    startTransition,
    setTransitionColor,
  };

  return (
    <PageTransitionContext.Provider value={contextValue}>
      {children}

      {/* Transition overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <>
            {/* Main overlay for most effects */}
            <div
              ref={overlayRef}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: transitionColor,
                zIndex: 9990,
                pointerEvents: 'none',
                opacity: 0,
              }}
            >
              {/* Motion blur simulation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: duration * 0.3, delay: duration * 0.2 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(
                    ${transitionDirection === 'up' || transitionDirection === 'down' ? '0deg' : '90deg'},
                    transparent,
                    rgba(255,255,255,0.1),
                    transparent
                  )`,
                  filter: 'blur(20px)',
                }}
              />
            </div>

            {/* Curtain blocks for curtain effect */}
            {transitionType === 'curtain' && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'row',
                  zIndex: 9991,
                  pointerEvents: 'none',
                }}
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      if (el) blocksRef.current[i] = el;
                    }}
                    style={{
                      flex: 1,
                      height: '100%',
                      backgroundColor: transitionColor,
                      transform: 'scaleY(0)',
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
};

// Page wrapper component with animation variants
interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children, className }) => {
  const pageVariants: Variants = {
    initial: {
      opacity: 0,
      y: 20,
      filter: 'blur(10px)',
    },
    enter: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      filter: 'blur(10px)',
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
      className={className}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
};

// Staggered reveal container
interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  staggerDelay = 0.1,
  className,
}) => {
  const containerVariants: Variants = {
    initial: {},
    enter: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.2,
      },
    },
    exit: {
      transition: {
        staggerChildren: staggerDelay * 0.5,
        staggerDirection: -1,
      },
    },
  };

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Staggered item
interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export const StaggerItem: React.FC<StaggerItemProps> = ({ children, className }) => {
  const itemVariants: Variants = {
    initial: {
      opacity: 0,
      y: 30,
    },
    enter: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
};

export { PageTransitionContext };
export type { PageTransitionContextType, TransitionDirection, TransitionType };
