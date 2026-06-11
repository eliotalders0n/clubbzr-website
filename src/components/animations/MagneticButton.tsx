'use client';

import React, {
  useRef,
  useEffect,
  useState,
  ReactNode,
  CSSProperties,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { useCursor } from './CustomCursor';

// Props interface
interface MagneticButtonProps {
  children: ReactNode;
  strength?: number;
  radius?: number;
  scale?: number;
  elasticity?: number;
  cursorText?: string;
  cursorScale?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

// Ref interface for external control
interface MagneticButtonRef {
  reset: () => void;
  element: HTMLDivElement | null;
}

export const MagneticButton = forwardRef<MagneticButtonRef, MagneticButtonProps>(
  (
    {
      children,
      strength = 0.35,
      radius = 200,
      scale = 1.05,
      elasticity = 0.15,
      cursorText,
      cursorScale = 1.5,
      disabled = false,
      className,
      style,
      onClick,
      onMouseEnter,
      onMouseLeave,
    },
    ref
  ) => {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [bounds, setBounds] = useState({ width: 0, height: 0, x: 0, y: 0 });

    // Try to use cursor context (may not be available)
    let cursorContext: ReturnType<typeof useCursor> | null = null;
    try {
      cursorContext = useCursor();
    } catch {
      // Cursor context not available, continue without it
    }

    // Motion values for position
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Spring animation for smooth movement
    const springConfig = {
      damping: 20,
      stiffness: 200,
      mass: elasticity,
    };

    const springX = useSpring(mouseX, springConfig);
    const springY = useSpring(mouseY, springConfig);

    // Transform for scale on hover
    const scaleValue = useMotionValue(1);
    const springScale = useSpring(scaleValue, {
      damping: 15,
      stiffness: 300,
    });

    // Rotation based on mouse position for subtle 3D effect
    const rotateX = useTransform(springY, [-50, 50], [5, -5]);
    const rotateY = useTransform(springX, [-50, 50], [-5, 5]);

    // Update bounds on mount and resize
    useEffect(() => {
      const updateBounds = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setBounds({
            width: rect.width,
            height: rect.height,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
        }
      };

      updateBounds();
      window.addEventListener('resize', updateBounds);
      window.addEventListener('scroll', updateBounds);

      return () => {
        window.removeEventListener('resize', updateBounds);
        window.removeEventListener('scroll', updateBounds);
      };
    }, []);

    // Register with magnetic cursor system if available
    useEffect(() => {
      if (cursorContext && buttonRef.current) {
        cursorContext.registerMagneticElement(buttonRef.current, strength);
        return () => {
          if (buttonRef.current) {
            cursorContext.unregisterMagneticElement(buttonRef.current);
          }
        };
      }
    }, [cursorContext, strength]);

    // Handle mouse move
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      if (distance < radius) {
        const pullX = distanceX * strength;
        const pullY = distanceY * strength;
        mouseX.set(pullX);
        mouseY.set(pullY);
      }
    };

    // Handle mouse enter
    const handleMouseEnter = () => {
      if (disabled) return;

      setIsHovered(true);
      scaleValue.set(scale);

      if (cursorContext) {
        if (cursorText) {
          cursorContext.setCursorText(cursorText);
        }
        cursorContext.setCursorScale(cursorScale);
        cursorContext.setCursorHovering(true);
      }

      onMouseEnter?.();
    };

    // Handle mouse leave
    const handleMouseLeave = () => {
      setIsHovered(false);
      mouseX.set(0);
      mouseY.set(0);
      scaleValue.set(1);

      if (cursorContext) {
        cursorContext.resetCursor();
      }

      onMouseLeave?.();
    };

    // Reset function for external control
    const reset = () => {
      mouseX.set(0);
      mouseY.set(0);
      scaleValue.set(1);
      setIsHovered(false);
    };

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      reset,
      element: buttonRef.current,
    }));

    return (
      <motion.div
        ref={buttonRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        className={className}
        style={{
          display: 'inline-block',
          cursor: disabled ? 'default' : 'pointer',
          perspective: '1000px',
          ...style,
        }}
      >
        <motion.div
          style={{
            x: springX,
            y: springY,
            scale: springScale,
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    );
  }
);

MagneticButton.displayName = 'MagneticButton';

// Magnetic text component for inline text links
interface MagneticTextProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  style?: CSSProperties;
  href?: string;
  onClick?: () => void;
}

export const MagneticText: React.FC<MagneticTextProps> = ({
  children,
  strength = 0.2,
  className,
  style,
  href,
  onClick,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 20, stiffness: 300 });
  const springY = useSpring(mouseY, { damping: 20, stiffness: 300 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = (e.clientX - centerX) * strength;
    const distanceY = (e.clientY - centerY) * strength;

    mouseX.set(distanceX);
    mouseY.set(distanceY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  const Component = href ? 'a' : 'span';

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        x: springX,
        y: springY,
        ...style,
      }}
      // @ts-expect-error - href only valid on anchor
      href={href}
      as={Component}
    >
      {children}
    </motion.span>
  );
};

// Magnetic container for grouping multiple magnetic elements
interface MagneticContainerProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  style?: CSSProperties;
}

export const MagneticContainer: React.FC<MagneticContainerProps> = ({
  children,
  strength = 0.15,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 25, stiffness: 200 });
  const springY = useSpring(mouseY, { damping: 25, stiffness: 200 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = (e.clientX - centerX) * strength;
    const distanceY = (e.clientY - centerY) * strength;

    mouseX.set(distanceX);
    mouseY.set(distanceY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={style}
    >
      <motion.div
        ref={childrenRef}
        style={{
          x: springX,
          y: springY,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// Repel button - opposite of magnetic, pushes away from cursor
interface RepelButtonProps extends Omit<MagneticButtonProps, 'strength'> {
  repelStrength?: number;
}

export const RepelButton = forwardRef<MagneticButtonRef, RepelButtonProps>(
  ({ repelStrength = 0.35, ...props }, ref) => {
    return <MagneticButton {...props} strength={-repelStrength} ref={ref} />;
  }
);

RepelButton.displayName = 'RepelButton';

// Elastic button with bounce effect
interface ElasticButtonProps {
  children: ReactNode;
  bounceIntensity?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export const ElasticButton: React.FC<ElasticButtonProps> = ({
  children,
  bounceIntensity = 0.3,
  className,
  style,
  onClick,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.div
      className={className}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        ...style,
      }}
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      animate={{
        scale: isPressed ? 1 - bounceIntensity * 0.5 : 1,
      }}
      whileHover={{ scale: 1 + bounceIntensity * 0.2 }}
      whileTap={{ scale: 1 - bounceIntensity * 0.3 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 10,
      }}
    >
      {children}
    </motion.div>
  );
};

export type { MagneticButtonProps, MagneticButtonRef };
