'use client';

import React, { useRef, useEffect, useState, ReactNode, CSSProperties } from 'react';
import { motion, Variants, useInView, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitType from 'split-type';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Animation type
type TextAnimationType =
  | 'char'
  | 'word'
  | 'line'
  | 'typewriter'
  | 'wave'
  | 'bounce'
  | 'glitch'
  | 'scramble';

// Base props for text reveal
interface TextRevealBaseProps {
  children: string;
  type?: TextAnimationType;
  delay?: number;
  duration?: number;
  stagger?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
  onComplete?: () => void;
}

// Character reveal component
interface CharRevealProps extends TextRevealBaseProps {
  as?: keyof React.JSX.IntrinsicElements;
}

export const CharReveal: React.FC<CharRevealProps> = ({
  children,
  delay = 0,
  duration = 0.05,
  stagger = 0.02,
  once = true,
  className,
  style,
  as: Component = 'div',
  onComplete,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });
  const controls = useAnimation();

  const characters = children.split('');

  useEffect(() => {
    if (isInView) {
      controls.start('visible').then(() => {
        onComplete?.();
      });
    }
  }, [isInView, controls, onComplete]);

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const charVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={containerVariants}
      className={className}
      style={{ display: 'inline-block', ...style }}
    >
      {characters.map((char, index) => (
        <motion.span
          key={index}
          variants={charVariants}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {char}
        </motion.span>
      ))}
    </motion.div>
  );
};

// Word reveal component
interface WordRevealProps extends TextRevealBaseProps {
  as?: keyof React.JSX.IntrinsicElements;
}

export const WordReveal: React.FC<WordRevealProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  stagger = 0.1,
  once = true,
  className,
  style,
  onComplete,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });
  const controls = useAnimation();

  const words = children.split(' ');

  useEffect(() => {
    if (isInView) {
      controls.start('visible').then(() => {
        onComplete?.();
      });
    }
  }, [isInView, controls, onComplete]);

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const wordVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 40,
      rotateX: -90,
    },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={containerVariants}
      className={className}
      style={{ display: 'flex', flexWrap: 'wrap', perspective: '1000px', ...style }}
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          variants={wordVariants}
          style={{
            display: 'inline-block',
            marginRight: '0.25em',
            transformStyle: 'preserve-3d',
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

// Line reveal component
interface LineRevealProps extends TextRevealBaseProps {
  splitLines?: boolean;
}

export const LineReveal: React.FC<LineRevealProps> = ({
  children,
  delay = 0,
  duration = 0.8,
  stagger = 0.15,
  once = true,
  className,
  style,
  onComplete,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });
  const controls = useAnimation();

  // Split text into lines (by newline character)
  const lines = children.split('\n');

  useEffect(() => {
    if (isInView) {
      controls.start('visible').then(() => {
        onComplete?.();
      });
    }
  }, [isInView, controls, onComplete]);

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const lineVariants: Variants = {
    hidden: {
      opacity: 0,
      y: '100%',
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={containerVariants}
      className={className}
      style={style}
    >
      {lines.map((line, index) => (
        <div key={index} style={{ overflow: 'hidden' }}>
          <motion.div variants={lineVariants}>{line || ' '}</motion.div>
        </div>
      ))}
    </motion.div>
  );
};

// Typewriter effect
interface TypewriterProps extends TextRevealBaseProps {
  cursor?: boolean;
  cursorChar?: string;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  children,
  delay = 0,
  duration = 0.05,
  cursor = true,
  cursorChar = '|',
  once = true,
  className,
  style,
  onComplete,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const isInView = useInView(ref, { once, margin: '-50px' });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isInView && !hasStarted.current) {
      hasStarted.current = true;
      let currentIndex = 0;

      const startTyping = () => {
        const interval = setInterval(() => {
          if (currentIndex < children.length) {
            setDisplayText(children.slice(0, currentIndex + 1));
            currentIndex++;
          } else {
            clearInterval(interval);
            onComplete?.();
          }
        }, duration * 1000);

        return () => clearInterval(interval);
      };

      const timeoutId = setTimeout(startTyping, delay * 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isInView, children, delay, duration, onComplete]);

  // Cursor blink effect
  useEffect(() => {
    if (!cursor) return;
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, [cursor]);

  return (
    <div ref={ref} className={className} style={style}>
      {displayText}
      {cursor && (
        <span style={{ opacity: showCursor ? 1 : 0, transition: 'opacity 0.1s' }}>
          {cursorChar}
        </span>
      )}
    </div>
  );
};

// Wave animation
interface WaveTextProps extends TextRevealBaseProps {
  amplitude?: number;
}

export const WaveText: React.FC<WaveTextProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  stagger = 0.05,
  amplitude = 20,
  once = false,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });

  const characters = children.split('');

  return (
    <div
      ref={ref}
      className={className}
      style={{ display: 'inline-block', ...style }}
    >
      {characters.map((char, index) => (
        <motion.span
          key={index}
          animate={
            isInView
              ? {
                  y: [0, -amplitude, 0],
                }
              : {}
          }
          transition={{
            duration,
            delay: delay + index * stagger,
            repeat: once ? 0 : Infinity,
            repeatDelay: characters.length * stagger,
            ease: 'easeInOut',
          }}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {char}
        </motion.span>
      ))}
    </div>
  );
};

// GSAP SplitText component for more complex animations
interface GSAPTextRevealProps {
  children: string;
  type?: 'chars' | 'words' | 'lines';
  animation?: 'fadeUp' | 'fadeIn' | 'scale' | 'rotate' | 'custom';
  customAnimation?: gsap.TweenVars;
  stagger?: number;
  duration?: number;
  scrub?: boolean;
  start?: string;
  end?: string;
  className?: string;
  style?: CSSProperties;
}

export const GSAPTextReveal: React.FC<GSAPTextRevealProps> = ({
  children,
  type = 'chars',
  animation = 'fadeUp',
  customAnimation,
  stagger = 0.02,
  duration = 0.5,
  scrub = false,
  start = 'top 80%',
  end = 'bottom 20%',
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const splitRef = useRef<SplitType | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Split text
    splitRef.current = new SplitType(element, {
      types: type === 'chars' ? 'chars' : type === 'words' ? 'words' : 'lines',
    });

    const targets =
      type === 'chars'
        ? splitRef.current.chars
        : type === 'words'
          ? splitRef.current.words
          : splitRef.current.lines;

    if (!targets) return;

    let animationConfig: gsap.TweenVars = {};

    switch (animation) {
      case 'fadeUp':
        gsap.set(targets, { opacity: 0, y: 50 });
        animationConfig = { opacity: 1, y: 0 };
        break;
      case 'fadeIn':
        gsap.set(targets, { opacity: 0 });
        animationConfig = { opacity: 1 };
        break;
      case 'scale':
        gsap.set(targets, { opacity: 0, scale: 0 });
        animationConfig = { opacity: 1, scale: 1 };
        break;
      case 'rotate':
        gsap.set(targets, { opacity: 0, rotation: 90, transformOrigin: 'left bottom' });
        animationConfig = { opacity: 1, rotation: 0 };
        break;
      case 'custom':
        animationConfig = customAnimation || {};
        break;
    }

    const tween = gsap.to(targets, {
      ...animationConfig,
      duration,
      stagger,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start,
        end,
        scrub,
      },
    });

    return () => {
      tween.kill();
      if (splitRef.current) {
        splitRef.current.revert();
      }
    };
  }, [children, type, animation, customAnimation, stagger, duration, scrub, start, end]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

// Scramble text effect
interface ScrambleTextProps extends TextRevealBaseProps {
  scrambleChars?: string;
  revealDelay?: number;
}

export const ScrambleText: React.FC<ScrambleTextProps> = ({
  children,
  delay = 0,
  duration = 2,
  scrambleChars = '!<>-_\\/[]{}=+*^?#________',
  once = true,
  className,
  style,
  onComplete,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState(children);
  const isInView = useInView(ref, { once, margin: '-50px' });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isInView && !hasStarted.current) {
      hasStarted.current = true;

      const startTime = Date.now() + delay * 1000;
      const endTime = startTime + duration * 1000;

      const animate = () => {
        const now = Date.now();

        if (now < startTime) {
          requestAnimationFrame(animate);
          return;
        }

        const progress = Math.min((now - startTime) / (duration * 1000), 1);
        const revealedLength = Math.floor(progress * children.length);

        let result = '';
        for (let i = 0; i < children.length; i++) {
          if (i < revealedLength) {
            result += children[i];
          } else if (children[i] === ' ') {
            result += ' ';
          } else {
            result += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
          }
        }

        setDisplayText(result);

        if (now < endTime) {
          requestAnimationFrame(animate);
        } else {
          setDisplayText(children);
          onComplete?.();
        }
      };

      requestAnimationFrame(animate);
    }
  }, [isInView, children, delay, duration, scrambleChars, onComplete]);

  return (
    <div ref={ref} className={className} style={{ fontFamily: 'monospace', ...style }}>
      {displayText}
    </div>
  );
};

// Kinetic typography - rotating words
interface RotatingWordsProps {
  words: string[];
  interval?: number;
  className?: string;
  style?: CSSProperties;
}

export const RotatingWords: React.FC<RotatingWordsProps> = ({
  words,
  interval = 3000,
  className,
  style,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {words.map((word, index) => (
        <motion.div
          key={word}
          initial={{ y: '100%', opacity: 0 }}
          animate={{
            y: index === currentIndex ? 0 : '-100%',
            opacity: index === currentIndex ? 1 : 0,
          }}
          transition={{
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            position: index === currentIndex ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            width: '100%',
          }}
        >
          {word}
        </motion.div>
      ))}
    </div>
  );
};

// Split text utility hook
export const useSplitText = (
  ref: React.RefObject<HTMLElement>,
  type: 'chars' | 'words' | 'lines' = 'chars'
) => {
  const [split, setSplit] = useState<SplitType | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const splitInstance = new SplitType(ref.current, {
      types: type === 'chars' ? 'chars' : type === 'words' ? 'words' : 'lines',
    });

    setSplit(splitInstance);

    return () => {
      splitInstance.revert();
    };
  }, [ref, type]);

  return split;
};

export type { TextAnimationType, TextRevealBaseProps };
