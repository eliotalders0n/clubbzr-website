'use client';

import React, {
  useRef,
  useEffect,
  useState,
  ReactNode,
  CSSProperties,
  forwardRef,
} from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Reveal type for image animations
type ImageRevealType =
  | 'fade'
  | 'clipLeft'
  | 'clipRight'
  | 'clipTop'
  | 'clipBottom'
  | 'clipCenter'
  | 'scale'
  | 'blur'
  | 'curtain';

// Base image reveal props
interface ImageRevealProps {
  src: string;
  alt: string;
  type?: ImageRevealType;
  duration?: number;
  delay?: number;
  once?: boolean;
  parallax?: boolean;
  parallaxSpeed?: number;
  hover?: boolean;
  hoverScale?: number;
  lazy?: boolean;
  aspectRatio?: number;
  className?: string;
  style?: CSSProperties;
  onLoad?: () => void;
  onRevealComplete?: () => void;
}

export const ImageReveal = forwardRef<HTMLDivElement, ImageRevealProps>(
  (
    {
      src,
      alt,
      type = 'clipBottom',
      duration = 1,
      delay = 0,
      once = true,
      parallax = false,
      parallaxSpeed = 0.3,
      hover = true,
      hoverScale = 1.05,
      lazy = true,
      aspectRatio,
      className,
      style,
      onLoad,
      onRevealComplete,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const isInView = useInView(containerRef, { once, margin: '-100px' });

    // Parallax setup
    const { scrollYProgress } = useScroll({
      target: containerRef,
      offset: ['start end', 'end start'],
    });

    const parallaxY = useTransform(
      scrollYProgress,
      [0, 1],
      parallax ? [100 * parallaxSpeed, -100 * parallaxSpeed] : [0, 0]
    );

    const smoothParallaxY = useSpring(parallaxY, { damping: 50, stiffness: 100 });

    // Get clip path based on reveal type
    const getClipPath = (revealed: boolean) => {
      if (!revealed) {
        switch (type) {
          case 'clipLeft':
            return 'inset(0% 100% 0% 0%)';
          case 'clipRight':
            return 'inset(0% 0% 0% 100%)';
          case 'clipTop':
            return 'inset(0% 0% 100% 0%)';
          case 'clipBottom':
            return 'inset(100% 0% 0% 0%)';
          case 'clipCenter':
            return 'inset(50% 50% 50% 50%)';
          default:
            return 'inset(0% 0% 0% 0%)';
        }
      }
      return 'inset(0% 0% 0% 0%)';
    };

    // Get initial and animate states based on type
    const getAnimationStates = () => {
      switch (type) {
        case 'fade':
          return {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
          };
        case 'scale':
          return {
            initial: { opacity: 0, scale: 1.2 },
            animate: { opacity: 1, scale: 1 },
          };
        case 'blur':
          return {
            initial: { opacity: 0, filter: 'blur(20px)' },
            animate: { opacity: 1, filter: 'blur(0px)' },
          };
        default:
          return {
            initial: { clipPath: getClipPath(false) },
            animate: { clipPath: getClipPath(true) },
          };
      }
    };

    const { initial, animate } = getAnimationStates();

    // Handle image load
    const handleLoad = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    // Forward ref
    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(containerRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = containerRef.current;
      }
    }, [ref]);

    return (
      <motion.div
        ref={containerRef}
        className={className}
        style={{
          overflow: 'hidden',
          position: 'relative',
          aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
          ...style,
        }}
        onMouseEnter={() => hover && setIsHovered(true)}
        onMouseLeave={() => hover && setIsHovered(false)}
      >
        {/* Reveal overlay for curtain effect */}
        {type === 'curtain' && (
          <motion.div
            initial={{ scaleY: 1, transformOrigin: 'top' }}
            animate={isInView && isLoaded ? { scaleY: 0 } : { scaleY: 1 }}
            transition={{
              duration,
              delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
              zIndex: 2,
            }}
            onAnimationComplete={() => onRevealComplete?.()}
          />
        )}

        {/* Image wrapper for parallax */}
        <motion.div
          style={{
            y: smoothParallaxY,
            width: '100%',
            height: parallax ? '120%' : '100%',
            position: parallax ? 'absolute' : 'relative',
            top: parallax ? '-10%' : 0,
          }}
        >
          <motion.img
            ref={imageRef}
            src={src}
            alt={alt}
            loading={lazy ? 'lazy' : 'eager'}
            onLoad={handleLoad}
            initial={type !== 'curtain' ? initial : { opacity: 1 }}
            animate={
              isInView && isLoaded
                ? type !== 'curtain'
                  ? animate
                  : { opacity: 1 }
                : type !== 'curtain'
                  ? initial
                  : { opacity: 1 }
            }
            transition={{
              duration,
              delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            onAnimationComplete={() => type !== 'curtain' && onRevealComplete?.()}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isHovered ? `scale(${hoverScale})` : 'scale(1)',
              transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </motion.div>

        {/* Loading placeholder */}
        {!isLoaded && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              animate={{
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#333',
              }}
            />
          </div>
        )}
      </motion.div>
    );
  }
);

ImageReveal.displayName = 'ImageReveal';

// Image with displacement/distortion on hover
interface DistortionImageProps {
  src: string;
  alt: string;
  displacementSrc?: string;
  intensity?: number;
  className?: string;
  style?: CSSProperties;
}

export const DistortionImage: React.FC<DistortionImageProps> = ({
  src,
  alt,
  intensity = 20,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useRef(0);
  const mouseY = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX.current = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY.current = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.img
        src={src}
        alt={alt}
        animate={{
          filter: isHovered
            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='turbulence'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.02' numOctaves='3' result='noise' seed='${Math.random()}'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='noise' scale='${intensity}'/%3E%3C/filter%3E%3C/svg%3E#turbulence")`
            : 'none',
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{
          duration: 0.5,
          ease: 'easeOut',
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </motion.div>
  );
};

// Parallax image container with depth effect
interface ParallaxImageContainerProps {
  children: ReactNode;
  depth?: number;
  className?: string;
  style?: CSSProperties;
}

export const ParallaxImageContainer: React.FC<ParallaxImageContainerProps> = ({
  children,
  depth = 50,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [depth, -depth]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.5, 1, 1, 0.5]);

  const smoothY = useSpring(y, { damping: 50, stiffness: 100 });
  const smoothScale = useSpring(scale, { damping: 50, stiffness: 100 });

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <motion.div
        style={{
          y: smoothY,
          scale: smoothScale,
          opacity,
          width: '100%',
          height: '120%',
          position: 'absolute',
          top: '-10%',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// Image sequence on scroll
interface ImageSequenceProps {
  images: string[];
  start?: string;
  end?: string;
  className?: string;
  style?: CSSProperties;
}

export const ImageSequence: React.FC<ImageSequenceProps> = ({
  images,
  start = 'top top',
  end = 'bottom bottom',
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImages = useRef<HTMLImageElement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load all images
  useEffect(() => {
    const loadImages = async () => {
      const imagePromises = images.map((src) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      });

      try {
        loadedImages.current = await Promise.all(imagePromises);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load images:', error);
      }
    };

    loadImages();
  }, [images]);

  // Setup scroll-driven animation
  useEffect(() => {
    if (!isLoaded || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const firstImage = loadedImages.current[0];
    canvas.width = firstImage.width;
    canvas.height = firstImage.height;

    // Draw first frame
    ctx.drawImage(firstImage, 0, 0);

    // Create scroll trigger
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start,
      end,
      scrub: true,
      onUpdate: (self) => {
        const index = Math.min(
          Math.floor(self.progress * loadedImages.current.length),
          loadedImages.current.length - 1
        );
        const image = loadedImages.current[index];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
      },
    });

    return () => {
      trigger.kill();
    };
  }, [isLoaded, start, end]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 'auto',
        }}
      />
    </div>
  );
};

// Lazy loading image with animation
interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  blurDataUrl?: string;
  className?: string;
  style?: CSSProperties;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  blurDataUrl,
  className,
  style,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        ...style,
      }}
    >
      {/* Blur placeholder */}
      {blurDataUrl && !isLoaded && (
        <img
          src={blurDataUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {/* Placeholder */}
      {placeholder && !isLoaded && !blurDataUrl && (
        <img
          src={placeholder}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Main image */}
      {isInView && (
        <motion.img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={isLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
    </div>
  );
};

export type { ImageRevealType, ImageRevealProps };
