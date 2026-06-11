'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  RefObject,
  MutableRefObject,
} from 'react';
import {
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  MotionValue,
  useInView as framerUseInView,
} from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================
// useScrollProgress - Track scroll progress
// ============================================
interface UseScrollProgressOptions {
  target?: RefObject<HTMLElement>;
  offset?: [string, string];
  smooth?: boolean;
  smoothConfig?: {
    damping: number;
    stiffness: number;
  };
}

interface UseScrollProgressReturn {
  progress: MotionValue<number>;
  scrollY: MotionValue<number>;
  scrollYProgress: MotionValue<number>;
}

export const useScrollProgress = (
  options: UseScrollProgressOptions = {}
): UseScrollProgressReturn => {
  const {
    target,
    offset = ['start end', 'end start'] as any,
    smooth = true,
    smoothConfig = { damping: 50, stiffness: 100 },
  } = options;

  const { scrollY, scrollYProgress } = useScroll({
    target,
    offset,
  });

  const smoothProgress = useSpring(scrollYProgress, smoothConfig);

  return {
    progress: smooth ? smoothProgress : scrollYProgress,
    scrollY,
    scrollYProgress,
  };
};

// ============================================
// useParallax - Parallax effect hook
// ============================================
interface UseParallaxOptions {
  speed?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  target?: RefObject<HTMLElement>;
  smooth?: boolean;
}

interface UseParallaxReturn {
  ref: RefObject<HTMLDivElement>;
  style: {
    y?: MotionValue<number>;
    x?: MotionValue<number>;
  };
}

export const useParallax = (options: UseParallaxOptions = {}): UseParallaxReturn => {
  const {
    speed = 0.5,
    direction = 'up',
    target,
    smooth = true,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const targetRef = target || ref;

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start end', 'end start'],
  });

  const distance = 100 * speed;

  const rawY = useTransform(
    scrollYProgress,
    [0, 1],
    direction === 'up' ? [distance, -distance] : [-distance, distance]
  );

  const rawX = useTransform(
    scrollYProgress,
    [0, 1],
    direction === 'left' ? [distance, -distance] : [-distance, distance]
  );

  const smoothY = useSpring(rawY, { damping: 50, stiffness: 100 });
  const smoothX = useSpring(rawX, { damping: 50, stiffness: 100 });

  const isHorizontal = direction === 'left' || direction === 'right';

  return {
    ref,
    style: isHorizontal
      ? { x: smooth ? smoothX : rawX }
      : { y: smooth ? smoothY : rawY },
  };
};

// ============================================
// useMousePosition - Track mouse position
// ============================================
interface MousePosition {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  isInViewport: boolean;
}

interface UseMousePositionOptions {
  smooth?: boolean;
  smoothConfig?: {
    damping: number;
    stiffness: number;
  };
  element?: RefObject<HTMLElement>;
}

interface UseMousePositionReturn {
  x: MotionValue<number>;
  y: MotionValue<number>;
  normalizedX: MotionValue<number>;
  normalizedY: MotionValue<number>;
  position: MousePosition;
}

export const useMousePosition = (
  options: UseMousePositionOptions = {}
): UseMousePositionReturn => {
  const {
    smooth = true,
    smoothConfig = { damping: 20, stiffness: 300 },
    element,
  } = options;

  const [position, setPosition] = useState<MousePosition>({
    x: 0,
    y: 0,
    normalizedX: 0,
    normalizedY: 0,
    isInViewport: false,
  });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const normalizedX = useMotionValue(0);
  const normalizedY = useMotionValue(0);

  const smoothX = useSpring(x, smoothConfig);
  const smoothY = useSpring(y, smoothConfig);
  const smoothNormalizedX = useSpring(normalizedX, smoothConfig);
  const smoothNormalizedY = useSpring(normalizedY, smoothConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      let newX: number, newY: number, normX: number, normY: number;

      if (element?.current) {
        const rect = element.current.getBoundingClientRect();
        newX = e.clientX - rect.left;
        newY = e.clientY - rect.top;
        normX = (newX / rect.width) * 2 - 1;
        normY = (newY / rect.height) * 2 - 1;
      } else {
        newX = e.clientX;
        newY = e.clientY;
        normX = (e.clientX / window.innerWidth) * 2 - 1;
        normY = (e.clientY / window.innerHeight) * 2 - 1;
      }

      x.set(newX);
      y.set(newY);
      normalizedX.set(normX);
      normalizedY.set(normY);

      setPosition({
        x: newX,
        y: newY,
        normalizedX: normX,
        normalizedY: normY,
        isInViewport: true,
      });
    };

    const handleMouseLeave = () => {
      setPosition((prev) => ({ ...prev, isInViewport: false }));
    };

    const target = element?.current || window;
    target.addEventListener('mousemove', handleMouseMove as EventListener);
    target.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      target.removeEventListener('mousemove', handleMouseMove as EventListener);
      target.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [element, x, y, normalizedX, normalizedY]);

  return {
    x: smooth ? smoothX : x,
    y: smooth ? smoothY : y,
    normalizedX: smooth ? smoothNormalizedX : normalizedX,
    normalizedY: smooth ? smoothNormalizedY : normalizedY,
    position,
  };
};

// ============================================
// useInView - Intersection observer with animation triggers
// ============================================
interface UseInViewOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  triggerOnce?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}

interface UseInViewReturn {
  ref: RefObject<HTMLDivElement>;
  isInView: boolean;
  hasEntered: boolean;
}

export const useInView = (options: UseInViewOptions = {}): UseInViewReturn => {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    once = false,
    triggerOnce = once,
    onEnter,
    onLeave,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;

        if (triggerOnce && hasEntered) {
          return;
        }

        setIsInView(inView);

        if (inView) {
          setHasEntered(true);
          onEnter?.();

          if (triggerOnce) {
            observer.disconnect();
          }
        } else {
          onLeave?.();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, hasEntered, onEnter, onLeave]);

  return { ref, isInView, hasEntered };
};

// ============================================
// useMagneticEffect - Magnetic mouse attraction
// ============================================
interface UseMagneticEffectOptions {
  strength?: number;
  radius?: number;
  smooth?: boolean;
}

interface UseMagneticEffectReturn {
  ref: RefObject<HTMLDivElement>;
  style: {
    x: MotionValue<number>;
    y: MotionValue<number>;
  };
  isActive: boolean;
}

export const useMagneticEffect = (
  options: UseMagneticEffectOptions = {}
): UseMagneticEffectReturn => {
  const { strength = 0.3, radius = 200, smooth = true } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const smoothX = useSpring(x, { damping: 20, stiffness: 300 });
  const smoothY = useSpring(y, { damping: 20, stiffness: 300 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      if (distance < radius) {
        setIsActive(true);
        x.set(distanceX * strength);
        y.set(distanceY * strength);
      } else {
        setIsActive(false);
        x.set(0);
        y.set(0);
      }
    };

    const handleMouseLeave = () => {
      setIsActive(false);
      x.set(0);
      y.set(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [strength, radius, x, y]);

  return {
    ref,
    style: {
      x: smooth ? smoothX : x,
      y: smooth ? smoothY : y,
    },
    isActive,
  };
};

// ============================================
// useGSAPAnimation - GSAP animation hook
// ============================================
interface UseGSAPAnimationOptions {
  animation: gsap.TweenVars;
  trigger?: boolean;
  scrollTrigger?: ScrollTrigger.Vars;
  delay?: number;
  onComplete?: () => void;
}

export const useGSAPAnimation = <T extends HTMLElement>(
  options: UseGSAPAnimationOptions
): RefObject<T> => {
  const ref = useRef<T>(null);
  const animationRef = useRef<gsap.core.Tween | null>(null);

  const {
    animation,
    trigger = true,
    scrollTrigger,
    delay = 0,
    onComplete,
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || !trigger) return;

    const config: gsap.TweenVars = {
      ...animation,
      delay,
      onComplete,
    };

    if (scrollTrigger) {
      config.scrollTrigger = {
        trigger: element,
        ...scrollTrigger,
      };
    }

    animationRef.current = gsap.to(element, config);

    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };
  }, [animation, trigger, scrollTrigger, delay, onComplete]);

  return ref;
};

// ============================================
// useScrollVelocity - Track scroll velocity
// ============================================
interface UseScrollVelocityReturn {
  velocity: number;
  direction: 'up' | 'down' | 'none';
  isScrolling: boolean;
}

export const useScrollVelocity = (): UseScrollVelocityReturn => {
  const [velocity, setVelocity] = useState(0);
  const [direction, setDirection] = useState<'up' | 'down' | 'none'>('none');
  const [isScrolling, setIsScrolling] = useState(false);

  const lastScrollY = useRef(0);
  const lastTime = useRef(Date.now());
  const velocityTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentTime = Date.now();
      const currentScrollY = window.scrollY;
      const timeDelta = currentTime - lastTime.current;
      const scrollDelta = currentScrollY - lastScrollY.current;

      if (timeDelta > 0) {
        const newVelocity = Math.abs(scrollDelta / timeDelta);
        setVelocity(newVelocity);

        if (scrollDelta > 0) {
          setDirection('down');
        } else if (scrollDelta < 0) {
          setDirection('up');
        }
      }

      lastScrollY.current = currentScrollY;
      lastTime.current = currentTime;

      setIsScrolling(true);

      if (velocityTimeout.current) {
        clearTimeout(velocityTimeout.current);
      }

      velocityTimeout.current = setTimeout(() => {
        setVelocity(0);
        setDirection('none');
        setIsScrolling(false);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (velocityTimeout.current) {
        clearTimeout(velocityTimeout.current);
      }
    };
  }, []);

  return { velocity, direction, isScrolling };
};

// ============================================
// useElementSize - Track element dimensions
// ============================================
interface ElementSize {
  width: number;
  height: number;
  top: number;
  left: number;
}

export const useElementSize = (ref: RefObject<HTMLElement>): ElementSize => {
  const [size, setSize] = useState<ElementSize>({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    window.addEventListener('scroll', updateSize, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateSize);
    };
  }, [ref]);

  return size;
};

// ============================================
// useReducedMotion - Detect reduced motion preference
// ============================================
export const useReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return reducedMotion;
};

// ============================================
// useRaf - RequestAnimationFrame hook
// ============================================
export const useRaf = (
  callback: (time: number, delta: number) => void,
  active = true
): void => {
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;

    const animate = (time: number) => {
      const delta = lastTimeRef.current ? time - lastTimeRef.current : 0;
      lastTimeRef.current = time;
      callbackRef.current(time, delta);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [active]);
};

// ============================================
// useTilt - 3D tilt effect on hover
// ============================================
interface UseTiltOptions {
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  speed?: number;
  glare?: boolean;
  maxGlare?: number;
}

interface UseTiltReturn {
  ref: RefObject<HTMLDivElement>;
  style: {
    transform: string;
    transition: string;
  };
  glareStyle: {
    opacity: number;
    transform: string;
  };
}

export const useTilt = (options: UseTiltOptions = {}): UseTiltReturn => {
  const {
    maxTilt = 15,
    perspective = 1000,
    scale = 1.05,
    speed = 400,
    glare = false,
    maxGlare = 0.5,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const tiltX = (maxTilt * 2 * y - maxTilt) * -1;
      const tiltY = maxTilt * 2 * x - maxTilt;

      setTilt({ x: tiltX, y: tiltY });
      setGlarePos({ x: x * 100, y: y * 100 });
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
      setIsHovered(false);
      setTilt({ x: 0, y: 0 });
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [maxTilt]);

  const style = {
    transform: `perspective(${perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? scale : 1})`,
    transition: isHovered ? `transform ${speed}ms ease-out` : `transform ${speed}ms ease-out`,
  };

  const glareStyle = {
    opacity: glare && isHovered ? maxGlare : 0,
    transform: `translate(${glarePos.x - 50}%, ${glarePos.y - 50}%)`,
  };

  return { ref, style, glareStyle };
};

// Re-export framer motion's useInView for convenience
export { framerUseInView };
