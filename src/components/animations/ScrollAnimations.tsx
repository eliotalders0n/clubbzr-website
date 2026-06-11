'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  CSSProperties,
} from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Scroll context interface
interface ScrollContextType {
  scrollProgress: MotionValue<number>;
  scrollY: MotionValue<number>;
  scrollDirection: 'up' | 'down';
  isScrolling: boolean;
}

// Create context
const ScrollContext = createContext<ScrollContextType | null>(null);

// Hook to use scroll context
export const useScrollContext = () => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScrollContext must be used within a ScrollAnimationProvider');
  }
  return context;
};

// Provider props
interface ScrollAnimationProviderProps {
  children: ReactNode;
}

export const ScrollAnimationProvider: React.FC<ScrollAnimationProviderProps> = ({
  children,
}) => {
  const { scrollYProgress, scrollY } = useScroll();
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const [isScrolling, setIsScrolling] = useState(false);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollDirection(currentScrollY > lastScrollY.current ? 'down' : 'up');
      lastScrollY.current = currentScrollY;

      setIsScrolling(true);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  const contextValue: ScrollContextType = {
    scrollProgress: scrollYProgress,
    scrollY,
    scrollDirection,
    isScrolling,
  };

  return (
    <ScrollContext.Provider value={contextValue}>{children}</ScrollContext.Provider>
  );
};

// Parallax component props
interface ParallaxProps {
  children: ReactNode;
  speed?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
  style?: CSSProperties;
}

export const Parallax: React.FC<ParallaxProps> = ({
  children,
  speed = 0.5,
  direction = 'up',
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const distance = 100 * speed;

  const yTransform = useTransform(
    scrollYProgress,
    [0, 1],
    direction === 'up' ? [distance, -distance] : [-distance, distance]
  );

  const xTransform = useTransform(
    scrollYProgress,
    [0, 1],
    direction === 'left' ? [distance, -distance] : [-distance, distance]
  );

  const smoothY = useSpring(yTransform, { damping: 50, stiffness: 100 });
  const smoothX = useSpring(xTransform, { damping: 50, stiffness: 100 });

  const isHorizontal = direction === 'left' || direction === 'right';

  return (
    <motion.div
      ref={ref}
      style={{
        y: isHorizontal ? 0 : smoothY,
        x: isHorizontal ? smoothX : 0,
        ...style,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Reveal animation type
type RevealType = 'fade' | 'slide' | 'scale' | 'blur' | 'clip';

// Scroll reveal props
interface ScrollRevealProps {
  children: ReactNode;
  type?: RevealType;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  type = 'fade',
  direction = 'up',
  delay = 0,
  duration = 0.6,
  threshold = 0.2,
  once = true,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (once && hasAnimated.current) return;
          setIsInView(true);
          hasAnimated.current = true;
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, threshold]);

  const getInitialState = () => {
    const base: Record<string, number | string> = { opacity: 0 };

    switch (type) {
      case 'slide':
        if (direction === 'up') base.y = 50;
        if (direction === 'down') base.y = -50;
        if (direction === 'left') base.x = 50;
        if (direction === 'right') base.x = -50;
        break;
      case 'scale':
        base.scale = 0.8;
        break;
      case 'blur':
        base.filter = 'blur(20px)';
        break;
      case 'clip':
        base.clipPath = 'inset(100% 0% 0% 0%)';
        break;
    }

    return base;
  };

  const getAnimateState = () => {
    const base: Record<string, number | string> = { opacity: 1 };

    switch (type) {
      case 'slide':
        base.y = 0;
        base.x = 0;
        break;
      case 'scale':
        base.scale = 1;
        break;
      case 'blur':
        base.filter = 'blur(0px)';
        break;
      case 'clip':
        base.clipPath = 'inset(0% 0% 0% 0%)';
        break;
    }

    return base;
  };

  return (
    <motion.div
      ref={ref}
      initial={getInitialState()}
      animate={isInView ? getAnimateState() : getInitialState()}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

// Progress-based animation props
interface ScrollProgressProps {
  children: (progress: MotionValue<number>) => ReactNode;
  start?: string;
  end?: string;
  className?: string;
}

export const ScrollProgress: React.FC<ScrollProgressProps> = ({
  children,
  start = 'start end',
  end = 'end start',
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [start, end] as any,
  });

  return (
    <div ref={ref} className={className}>
      {children(scrollYProgress)}
    </div>
  );
};

// GSAP ScrollTrigger component for more complex animations
interface GSAPScrollTriggerProps {
  children: ReactNode;
  animation: 'fadeIn' | 'slideUp' | 'scaleIn' | 'rotateIn' | 'custom';
  customAnimation?: gsap.TweenVars;
  trigger?: string;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  pin?: boolean;
  markers?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const GSAPScrollTrigger: React.FC<GSAPScrollTriggerProps> = ({
  children,
  animation,
  customAnimation,
  start = 'top 80%',
  end = 'bottom 20%',
  scrub = false,
  pin = false,
  markers = false,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let animationConfig: gsap.TweenVars = {};

    switch (animation) {
      case 'fadeIn':
        gsap.set(element, { opacity: 0 });
        animationConfig = { opacity: 1 };
        break;
      case 'slideUp':
        gsap.set(element, { opacity: 0, y: 100 });
        animationConfig = { opacity: 1, y: 0 };
        break;
      case 'scaleIn':
        gsap.set(element, { opacity: 0, scale: 0.8 });
        animationConfig = { opacity: 1, scale: 1 };
        break;
      case 'rotateIn':
        gsap.set(element, { opacity: 0, rotation: -10 });
        animationConfig = { opacity: 1, rotation: 0 };
        break;
      case 'custom':
        animationConfig = customAnimation || {};
        break;
    }

    animationRef.current = gsap.to(element, {
      ...animationConfig,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start,
        end,
        scrub,
        pin,
        markers,
      },
    });

    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [animation, customAnimation, start, end, scrub, pin, markers]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

// Horizontal scroll section
interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

export const HorizontalScroll: React.FC<HorizontalScrollProps> = ({
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const scroll = scrollRef.current;
    if (!container || !scroll) return;

    const scrollWidth = scroll.scrollWidth;
    const containerWidth = container.offsetWidth;

    const tween = gsap.to(scroll, {
      x: -(scrollWidth - containerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: () => `+=${scrollWidth - containerWidth}`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    return () => {
      tween.kill();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ overflow: 'hidden' }}>
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

export { ScrollContext };
export type { ScrollContextType, RevealType };
