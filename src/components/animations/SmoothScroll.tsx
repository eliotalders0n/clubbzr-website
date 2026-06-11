'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Lenis options interface
interface LenisOptions {
  duration?: number;
  easing?: (t: number) => number;
  orientation?: 'vertical' | 'horizontal';
  gestureOrientation?: 'vertical' | 'horizontal' | 'both';
  smoothWheel?: boolean;
  smoothTouch?: boolean;
  touchMultiplier?: number;
  wheelMultiplier?: number;
  infinite?: boolean;
  autoResize?: boolean;
}

// Scroll context interface
interface SmoothScrollContextType {
  lenis: Lenis | null;
  scrollProgress: number;
  scrollY: number;
  scrollDirection: 'up' | 'down' | 'none';
  isScrolling: boolean;
  scrollTo: (
    target: number | string | HTMLElement,
    options?: {
      offset?: number;
      duration?: number;
      immediate?: boolean;
      lock?: boolean;
      easing?: (t: number) => number;
    }
  ) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

// Create context
const SmoothScrollContext = createContext<SmoothScrollContextType | null>(null);

// Hook to use smooth scroll
export const useSmoothScroll = () => {
  const context = useContext(SmoothScrollContext);
  if (!context) {
    throw new Error('useSmoothScroll must be used within a SmoothScrollProvider');
  }
  return context;
};

// Provider props
interface SmoothScrollProviderProps {
  children: ReactNode;
  options?: LenisOptions;
  root?: boolean;
  autoRaf?: boolean;
}

// Default easing function
const defaultEasing = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

export const SmoothScrollProvider: React.FC<SmoothScrollProviderProps> = ({
  children,
  options = {},
  root = true,
  autoRaf = true,
}) => {
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none');
  const [isScrolling, setIsScrolling] = useState(false);

  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Lenis
  useEffect(() => {
    const lenis = new Lenis({
      duration: options.duration ?? 1.2,
      easing: options.easing ?? defaultEasing,
      orientation: options.orientation ?? 'vertical',
      gestureOrientation: options.gestureOrientation ?? 'vertical',
      smoothWheel: options.smoothWheel ?? true,
      // smoothTouch: options.smoothTouch ?? false, // removed - not in LenisOptions
      touchMultiplier: options.touchMultiplier ?? 2,
      wheelMultiplier: options.wheelMultiplier ?? 1,
      infinite: options.infinite ?? false,
      autoResize: options.autoResize ?? true,
    });

    lenisRef.current = lenis;

    // Integrate with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // Scroll event handler
    const handleScroll = (e: { scroll: number; limit: number; progress: number }) => {
      setScrollY(e.scroll);
      setScrollProgress(e.progress);

      // Determine scroll direction
      if (e.scroll > lastScrollY.current) {
        setScrollDirection('down');
      } else if (e.scroll < lastScrollY.current) {
        setScrollDirection('up');
      }
      lastScrollY.current = e.scroll;

      // Track scrolling state
      setIsScrolling(true);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
        setScrollDirection('none');
      }, 150);
    };

    lenis.on('scroll', handleScroll);

    // Auto RAF loop
    if (autoRaf) {
      const raf = (time: number) => {
        lenis.raf(time);
        rafRef.current = requestAnimationFrame(raf);
      };
      rafRef.current = requestAnimationFrame(raf);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      lenis.destroy();
    };
  }, [options, autoRaf]);

  // Scroll to function
  const scrollTo = useCallback(
    (
      target: number | string | HTMLElement,
      scrollOptions?: {
        offset?: number;
        duration?: number;
        immediate?: boolean;
        lock?: boolean;
        easing?: (t: number) => number;
      }
    ) => {
      lenisRef.current?.scrollTo(target, scrollOptions);
    },
    []
  );

  // Control functions
  const start = useCallback(() => {
    lenisRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    lenisRef.current?.stop();
  }, []);

  const destroy = useCallback(() => {
    lenisRef.current?.destroy();
  }, []);

  const contextValue: SmoothScrollContextType = {
    lenis: lenisRef.current,
    scrollProgress,
    scrollY,
    scrollDirection,
    isScrolling,
    scrollTo,
    start,
    stop,
    destroy,
  };

  return (
    <SmoothScrollContext.Provider value={contextValue}>
      {root ? (
        <div data-lenis-root style={{ height: '100%' }}>
          {children}
        </div>
      ) : (
        children
      )}
    </SmoothScrollContext.Provider>
  );
};

// Scroll progress bar component
interface ScrollProgressBarProps {
  position?: 'top' | 'bottom' | 'left' | 'right';
  color?: string;
  height?: number;
  zIndex?: number;
  className?: string;
}

export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({
  position = 'top',
  color = '#ffffff',
  height = 3,
  zIndex = 9999,
  className,
}) => {
  const { scrollProgress } = useSmoothScroll();

  const isVertical = position === 'left' || position === 'right';

  const positionStyles: React.CSSProperties = {
    top: position === 'top' ? 0 : position === 'bottom' ? 'auto' : 0,
    bottom: position === 'bottom' ? 0 : 'auto',
    left: position === 'left' ? 0 : position === 'right' ? 'auto' : 0,
    right: position === 'right' ? 0 : 'auto',
  };

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        ...positionStyles,
        width: isVertical ? height : '100%',
        height: isVertical ? '100%' : height,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: isVertical ? '100%' : `${scrollProgress * 100}%`,
          height: isVertical ? `${scrollProgress * 100}%` : '100%',
          backgroundColor: color,
          transition: 'none',
          transformOrigin: isVertical ? 'top' : 'left',
        }}
      />
    </div>
  );
};

// Scroll indicator component
interface ScrollIndicatorProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ className, style }) => {
  const { scrollY } = useSmoothScroll();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(scrollY < 100);
  }, [scrollY]);

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        style={{
          width: 30,
          height: 50,
          border: '2px solid rgba(255, 255, 255, 0.5)',
          borderRadius: 20,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 4,
            height: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: 2,
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'scrollIndicator 1.5s infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes scrollIndicator {
          0% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
        }
      `}</style>
    </div>
  );
};

// Scroll to top button
interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  threshold = 300,
  className,
  style,
  children,
}) => {
  const { scrollY, scrollTo } = useSmoothScroll();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(scrollY > threshold);
  }, [scrollY, threshold]);

  const handleClick = () => {
    scrollTo(0, { duration: 1.5 });
  };

  return (
    <button
      className={className}
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: 40,
        right: 40,
        width: 50,
        height: 50,
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: 'none',
        cursor: 'pointer',
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease, visibility 0.3s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        ...style,
      }}
    >
      {children || (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      )}
    </button>
  );
};

// Section detection hook
interface Section {
  id: string;
  element: HTMLElement;
}

export const useSectionDetection = (sectionIds: string[]) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { scrollY } = useSmoothScroll();

  useEffect(() => {
    const sections: Section[] = sectionIds
      .map((id) => {
        const element = document.getElementById(id);
        return element ? { id, element } : null;
      })
      .filter((section): section is Section => section !== null);

    const viewportHeight = window.innerHeight;
    const threshold = viewportHeight * 0.3;

    for (const section of sections) {
      const rect = section.element.getBoundingClientRect();
      if (rect.top < threshold && rect.bottom > threshold) {
        setActiveSection(section.id);
        break;
      }
    }
  }, [scrollY, sectionIds]);

  return activeSection;
};

// Horizontal scroll container with Lenis
interface HorizontalScrollContainerProps {
  children: ReactNode;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const HorizontalScrollContainer: React.FC<HorizontalScrollContainerProps> = ({
  children,
  speed = 1,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useSmoothScroll();

  useEffect(() => {
    const container = containerRef.current;
    const scroll = scrollRef.current;
    if (!container || !scroll) return;

    const scrollWidth = scroll.scrollWidth;
    const containerWidth = container.offsetWidth;
    const maxScroll = scrollWidth - containerWidth;

    const tween = gsap.to(scroll, {
      x: -maxScroll,
      ease: 'none',
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: () => `+=${maxScroll * speed}`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    return () => {
      tween.kill();
    };
  }, [speed]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          width: 'fit-content',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export { SmoothScrollContext };
export type { SmoothScrollContextType, LenisOptions };
