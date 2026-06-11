'use client';

import React, { forwardRef, ReactNode, CSSProperties } from 'react';
import { motion, HTMLMotionProps, useScroll, useTransform } from 'framer-motion';
import { cn } from '../../utils/cn';
import { Container } from './Container';

// Section variants
type SectionVariant = 'default' | 'contained' | 'full-width' | 'full-bleed';

// Padding presets
type PaddingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

// Background options
type BackgroundStyle = 'transparent' | 'light' | 'dark' | 'gradient' | 'accent';

interface SectionProps extends Omit<HTMLMotionProps<'section'>, 'children'> {
  children: ReactNode;
  /** Section layout variant */
  variant?: SectionVariant;
  /** Vertical padding preset */
  padding?: PaddingSize;
  /** Make section full viewport height */
  fullscreen?: boolean;
  /** Minimum height */
  minHeight?: string;
  /** Background style preset */
  background?: BackgroundStyle;
  /** Custom background color */
  backgroundColor?: string;
  /** Background image URL */
  backgroundImage?: string;
  /** Enable parallax on background */
  parallax?: boolean;
  /** Parallax speed (0-1) */
  parallaxSpeed?: number;
  /** Include a grid container */
  grid?: boolean;
  /** Number of grid columns when grid is enabled */
  gridCols?: 1 | 2 | 3 | 4 | 6 | 12;
  /** Enable fade-in animation on scroll */
  animate?: boolean;
  /** Add separator line at bottom */
  separator?: boolean;
  /** Section ID for navigation */
  id?: string;
  /** Custom className */
  className?: string;
  /** Inner content className */
  innerClassName?: string;
  /** Custom styles */
  style?: CSSProperties;
}

// Padding mapping
const paddingMap: Record<PaddingSize, string> = {
  none: 'py-0',
  sm: 'py-8 sm:py-12',
  md: 'py-12 sm:py-16 lg:py-20',
  lg: 'py-16 sm:py-24 lg:py-32',
  xl: 'py-24 sm:py-32 lg:py-40',
  hero: 'py-32 sm:py-40 lg:py-48',
};

// Background mapping
const backgroundMap: Record<BackgroundStyle, string> = {
  transparent: 'bg-transparent',
  light: 'bg-bzr-white',
  dark: 'bg-bzr-black',
  gradient: 'bg-gradient-to-b from-bzr-black via-bzr-gray-900 to-bzr-black',
  accent: 'bg-bzr-blue',
};

// Grid columns mapping
const gridColsMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  12: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-12',
};

export const Section = forwardRef<HTMLElement, SectionProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'lg',
      fullscreen = false,
      minHeight,
      background = 'transparent',
      backgroundColor,
      backgroundImage,
      parallax = false,
      parallaxSpeed = 0.5,
      grid = false,
      gridCols = 1,
      animate = false,
      separator = false,
      id,
      className,
      innerClassName,
      style,
      ...props
    },
    ref
  ) => {
    // Parallax scroll effect
    const { scrollYProgress } = useScroll();
    const y = useTransform(
      scrollYProgress,
      [0, 1],
      ['0%', `${parallaxSpeed * 50}%`]
    );

    // Animation variants
    const sectionVariants: any = {
      hidden: {
        opacity: 0,
        y: 50,
      },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1],
        },
      },
    };

    // Build section classes
    const sectionClasses = cn(
      'relative overflow-hidden',
      paddingMap[padding],
      !backgroundColor && backgroundMap[background],
      fullscreen && 'min-h-screen flex flex-col justify-center',
      separator && 'border-b border-bzr-gray-800',
      className
    );

    // Determine content wrapper based on variant
    const renderContent = () => {
      const gridClasses = grid
        ? cn('grid gap-6 md:gap-8 lg:gap-12', gridColsMap[gridCols])
        : '';

      const contentClasses = cn(innerClassName, gridClasses);

      switch (variant) {
        case 'full-bleed':
          return (
            <div className={contentClasses}>
              {children}
            </div>
          );
        case 'full-width':
          return (
            <Container size="full" paddingX="md" className={contentClasses}>
              {children}
            </Container>
          );
        case 'contained':
          return (
            <Container size="md" paddingX="md" className={contentClasses}>
              {children}
            </Container>
          );
        default:
          return (
            <Container size="lg" paddingX="md" className={contentClasses}>
              {children}
            </Container>
          );
      }
    };

    // Build inline styles
    const sectionStyle: CSSProperties = {
      backgroundColor,
      minHeight: fullscreen ? '100vh' : minHeight,
      ...style,
    };

    return (
      <motion.section
        ref={ref}
        id={id}
        className={sectionClasses}
        style={sectionStyle}
        initial={animate ? 'hidden' : undefined}
        whileInView={animate ? 'visible' : undefined}
        viewport={animate ? { once: true, margin: '-100px' } : undefined}
        variants={animate ? sectionVariants : undefined}
        {...props}
      >
        {/* Background image with optional parallax */}
        {backgroundImage && (
          <motion.div
            className="absolute inset-0 z-0"
            style={parallax ? { y } : undefined}
          >
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
            {/* Overlay for readability */}
            <div className="absolute inset-0 bg-bzr-black/60" />
          </motion.div>
        )}

        {/* Content */}
        <div className="relative z-10">
          {renderContent()}
        </div>
      </motion.section>
    );
  }
);

Section.displayName = 'Section';

// Hero Section variant with special styling
interface HeroSectionProps extends Omit<SectionProps, 'padding' | 'fullscreen'> {
  /** Enable overlay on background */
  overlay?: boolean;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
  /** Vertical alignment */
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export const HeroSection = forwardRef<HTMLElement, HeroSectionProps>(
  (
    {
      children,
      overlay = true,
      overlayOpacity = 0.5,
      verticalAlign = 'center',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const alignMap = {
      top: 'justify-start pt-32',
      center: 'justify-center',
      bottom: 'justify-end pb-32',
    };

    return (
      <Section
        ref={ref}
        fullscreen
        padding="none"
        className={cn(
          'flex flex-col',
          alignMap[verticalAlign],
          className
        )}
        style={style}
        {...props}
      >
        {/* Overlay */}
        {overlay && props.backgroundImage && (
          <div
            className="absolute inset-0 bg-bzr-black z-0"
            style={{ opacity: overlayOpacity }}
          />
        )}
        <div className="relative z-10 w-full">
          {children}
        </div>
      </Section>
    );
  }
);

HeroSection.displayName = 'HeroSection';

// Split Section - two column layout
interface SplitSectionProps extends Omit<SectionProps, 'grid' | 'gridCols'> {
  /** Left side content */
  left: ReactNode;
  /** Right side content */
  right: ReactNode;
  /** Reverse order on mobile */
  reverseMobile?: boolean;
  /** Split ratio */
  ratio?: '50/50' | '40/60' | '60/40' | '30/70' | '70/30';
  /** Gap between columns */
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  /** Vertical alignment */
  align?: 'top' | 'center' | 'bottom' | 'stretch';
}

const ratioMap: Record<string, string> = {
  '50/50': 'lg:grid-cols-2',
  '40/60': 'lg:grid-cols-[2fr_3fr]',
  '60/40': 'lg:grid-cols-[3fr_2fr]',
  '30/70': 'lg:grid-cols-[1fr_2fr]',
  '70/30': 'lg:grid-cols-[2fr_1fr]',
};

const splitGapMap: Record<string, string> = {
  sm: 'gap-8',
  md: 'gap-12',
  lg: 'gap-16 lg:gap-24',
  xl: 'gap-20 lg:gap-32',
};

const splitAlignMap: Record<string, string> = {
  top: 'items-start',
  center: 'items-center',
  bottom: 'items-end',
  stretch: 'items-stretch',
};

export const SplitSection = forwardRef<HTMLElement, SplitSectionProps>(
  (
    {
      left,
      right,
      reverseMobile = false,
      ratio = '50/50',
      gap = 'lg',
      align = 'center',
      className,
      innerClassName,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Section
        ref={ref}
        className={className}
        innerClassName={cn(
          'grid grid-cols-1',
          ratioMap[ratio],
          splitGapMap[gap],
          splitAlignMap[align],
          innerClassName
        )}
        {...props}
      >
        <div className={cn(reverseMobile && 'order-2 lg:order-1')}>
          {left}
        </div>
        <div className={cn(reverseMobile && 'order-1 lg:order-2')}>
          {right}
        </div>
        {children}
      </Section>
    );
  }
);

SplitSection.displayName = 'SplitSection';

export type {
  SectionProps,
  HeroSectionProps,
  SplitSectionProps,
  SectionVariant,
  PaddingSize,
  BackgroundStyle,
};
