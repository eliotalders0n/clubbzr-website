'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';

// Cursor shape types
type CursorShape = 'circle' | 'square' | 'text';

// Cursor state interface
interface CursorState {
  shape: CursorShape;
  text: string;
  isHovering: boolean;
  isPressed: boolean;
  scale: number;
  color: string;
  blend: 'difference' | 'normal' | 'exclusion';
}

// Context interface
interface CursorContextType {
  setCursorText: (text: string) => void;
  setCursorShape: (shape: CursorShape) => void;
  setCursorHovering: (hovering: boolean) => void;
  setCursorScale: (scale: number) => void;
  setCursorColor: (color: string) => void;
  setCursorBlend: (blend: 'difference' | 'normal' | 'exclusion') => void;
  resetCursor: () => void;
  registerMagneticElement: (element: HTMLElement, strength?: number) => void;
  unregisterMagneticElement: (element: HTMLElement) => void;
}

// Default cursor state
const defaultCursorState: CursorState = {
  shape: 'circle',
  text: '',
  isHovering: false,
  isPressed: false,
  scale: 1,
  color: '#ffffff',
  blend: 'difference',
};

// Create context
const CursorContext = createContext<CursorContextType | null>(null);

// Hook to use cursor context
export const useCursor = () => {
  const context = useContext(CursorContext);
  if (!context) {
    throw new Error('useCursor must be used within a CursorProvider');
  }
  return context;
};

// Trail particle interface
interface TrailParticle {
  id: number;
  x: number;
  y: number;
}

// Props for cursor provider
interface CursorProviderProps {
  children: ReactNode;
  trailLength?: number;
  cursorSize?: number;
  springConfig?: {
    damping: number;
    stiffness: number;
    mass: number;
  };
}

// Magnetic element data
interface MagneticElement {
  element: HTMLElement;
  strength: number;
}

export const CursorProvider: React.FC<CursorProviderProps> = ({
  children,
  trailLength = 8,
  cursorSize = 20,
  springConfig = { damping: 25, stiffness: 400, mass: 0.5 },
}) => {
  const [cursorState, setCursorState] = useState<CursorState>(defaultCursorState);
  const [trail, setTrail] = useState<TrailParticle[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const magneticElements = useRef<Map<HTMLElement, MagneticElement>>(new Map());
  const trailIdRef = useRef(0);

  // Mouse position with spring animation
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  // Magnetic offset
  const magneticX = useMotionValue(0);
  const magneticY = useMotionValue(0);

  const springMagneticX = useSpring(magneticX, { damping: 15, stiffness: 150 });
  const springMagneticY = useSpring(magneticY, { damping: 15, stiffness: 150 });

  // Check for touch device
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          // @ts-expect-error - msMaxTouchPoints is IE specific
          navigator.msMaxTouchPoints > 0
      );
    };
    checkTouchDevice();
  }, []);

  // Context functions
  const setCursorText = useCallback((text: string) => {
    setCursorState((prev) => ({ ...prev, text, isHovering: text !== '' }));
  }, []);

  const setCursorShape = useCallback((shape: CursorShape) => {
    setCursorState((prev) => ({ ...prev, shape }));
  }, []);

  const setCursorHovering = useCallback((isHovering: boolean) => {
    setCursorState((prev) => ({ ...prev, isHovering }));
  }, []);

  const setCursorScale = useCallback((scale: number) => {
    setCursorState((prev) => ({ ...prev, scale }));
  }, []);

  const setCursorColor = useCallback((color: string) => {
    setCursorState((prev) => ({ ...prev, color }));
  }, []);

  const setCursorBlend = useCallback((blend: 'difference' | 'normal' | 'exclusion') => {
    setCursorState((prev) => ({ ...prev, blend }));
  }, []);

  const resetCursor = useCallback(() => {
    setCursorState(defaultCursorState);
    magneticX.set(0);
    magneticY.set(0);
  }, [magneticX, magneticY]);

  const registerMagneticElement = useCallback(
    (element: HTMLElement, strength = 0.3) => {
      magneticElements.current.set(element, { element, strength });
    },
    []
  );

  const unregisterMagneticElement = useCallback((element: HTMLElement) => {
    magneticElements.current.delete(element);
  }, []);

  // Mouse move handler
  useEffect(() => {
    if (isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);

      // Update trail
      setTrail((prev) => {
        const newTrail = [
          { id: trailIdRef.current++, x: e.clientX, y: e.clientY },
          ...prev.slice(0, trailLength - 1),
        ];
        return newTrail;
      });

      // Check magnetic elements
      let closestElement: MagneticElement | null = null;
      let closestDistance = Infinity;

      magneticElements.current.forEach((magElement) => {
        const rect = magElement.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.sqrt(
          Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
        );
        const threshold = Math.max(rect.width, rect.height) * 1.5;

        if (distance < threshold && distance < closestDistance) {
          closestDistance = distance;
          closestElement = magElement;
        }
      });

      if (closestElement) {
        const rect = closestElement.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const offsetX = (e.clientX - centerX) * closestElement.strength;
        const offsetY = (e.clientY - centerY) * closestElement.strength;
        magneticX.set(offsetX);
        magneticY.set(offsetY);
      } else {
        magneticX.set(0);
        magneticY.set(0);
      }
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseDown = () =>
      setCursorState((prev) => ({ ...prev, isPressed: true }));
    const handleMouseUp = () =>
      setCursorState((prev) => ({ ...prev, isPressed: false }));

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isTouchDevice, mouseX, mouseY, magneticX, magneticY, trailLength]);

  // Calculate cursor size based on state
  const getCursorSize = () => {
    let size = cursorSize * cursorState.scale;
    if (cursorState.isHovering) size *= 2.5;
    if (cursorState.isPressed) size *= 0.9;
    return size;
  };

  // Get border radius based on shape
  const getBorderRadius = () => {
    switch (cursorState.shape) {
      case 'circle':
        return '50%';
      case 'square':
        return '4px';
      case 'text':
        return '2px';
      default:
        return '50%';
    }
  };

  const contextValue: CursorContextType = {
    setCursorText,
    setCursorShape,
    setCursorHovering,
    setCursorScale,
    setCursorColor,
    setCursorBlend,
    resetCursor,
    registerMagneticElement,
    unregisterMagneticElement,
  };

  if (isTouchDevice) {
    return <CursorContext.Provider value={contextValue}>{children}</CursorContext.Provider>;
  }

  return (
    <CursorContext.Provider value={contextValue}>
      {children}

      {/* Trail particles */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      >
        {trail.map((particle, index) => (
          <motion.div
            key={particle.id}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{
              opacity: 0,
              scale: 0.5,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: particle.x,
              top: particle.y,
              width: cursorSize * 0.3,
              height: cursorSize * 0.3,
              borderRadius: '50%',
              backgroundColor: cursorState.color,
              transform: 'translate(-50%, -50%)',
              mixBlendMode: cursorState.blend,
              opacity: (trailLength - index) / trailLength * 0.3,
            }}
          />
        ))}
      </div>

      {/* Main cursor */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: springX,
          y: springY,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        <motion.div
          animate={{
            width: getCursorSize(),
            height: cursorState.shape === 'text' ? getCursorSize() * 0.1 : getCursorSize(),
            borderRadius: getBorderRadius(),
            opacity: isVisible ? 1 : 0,
          }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 300,
          }}
          style={{
            x: springMagneticX,
            y: springMagneticY,
            backgroundColor: cursorState.isHovering ? 'transparent' : cursorState.color,
            border: cursorState.isHovering
              ? `2px solid ${cursorState.color}`
              : 'none',
            transform: 'translate(-50%, -50%)',
            mixBlendMode: cursorState.blend,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Cursor text */}
          <AnimatePresence>
            {cursorState.text && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  color: cursorState.color,
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {cursorState.text}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Dot cursor (inner) */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: mouseX,
          y: mouseY,
          pointerEvents: 'none',
          zIndex: 10000,
        }}
      >
        <motion.div
          animate={{
            width: cursorState.isPressed ? 6 : 4,
            height: cursorState.isPressed ? 6 : 4,
            opacity: isVisible && !cursorState.isHovering ? 1 : 0,
          }}
          style={{
            borderRadius: '50%',
            backgroundColor: cursorState.color,
            transform: 'translate(-50%, -50%)',
            mixBlendMode: cursorState.blend,
          }}
        />
      </motion.div>

      {/* Global style to hide default cursor */}
      <style>{`
        * {
          cursor: none !important;
        }
      `}</style>
    </CursorContext.Provider>
  );
};

// Export context for external use
export { CursorContext };
export type { CursorContextType, CursorState, CursorShape };
