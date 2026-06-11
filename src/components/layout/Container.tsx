'use client';

import React, { forwardRef, ReactNode, CSSProperties } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../utils/cn';

// Container size variants
type ContainerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

// Padding presets
type PaddingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface ContainerProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Max-width variant */
  size?: ContainerSize;
  /** Horizontal padding preset */
  paddingX?: PaddingSize;
  /** Vertical padding preset */
  paddingY?: PaddingSize;
  /** Center the container */
  centered?: boolean;
  /** Enable animations */
  animate?: boolean;
  /** Custom className */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
  /** As element type */
  as?: 'div' | 'section' | 'article' | 'main' | 'aside';
}

// Size to max-width mapping
const sizeMap: Record<ContainerSize, string> = {
  xs: 'max-w-screen-sm',   // 640px
  sm: 'max-w-screen-md',   // 768px
  md: 'max-w-screen-lg',   // 1024px
  lg: 'max-w-screen-xl',   // 1280px
  xl: 'max-w-screen-2xl',  // 1536px
  full: 'max-w-full',
};

// Padding X mapping
const paddingXMap: Record<PaddingSize, string> = {
  none: 'px-0',
  sm: 'px-4 sm:px-6',
  md: 'px-6 sm:px-8 lg:px-12',
  lg: 'px-8 sm:px-12 lg:px-16',
  xl: 'px-12 sm:px-16 lg:px-24',
};

// Padding Y mapping
const paddingYMap: Record<PaddingSize, string> = {
  none: 'py-0',
  sm: 'py-4 sm:py-6',
  md: 'py-8 sm:py-12 lg:py-16',
  lg: 'py-12 sm:py-16 lg:py-24',
  xl: 'py-16 sm:py-24 lg:py-32',
};

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      children,
      size = 'lg',
      paddingX = 'md',
      paddingY = 'none',
      centered = true,
      animate = false,
      className,
      style,
      as = 'div',
      ...props
    },
    ref
  ) => {
    const containerClasses = cn(
      'w-full',
      sizeMap[size],
      paddingXMap[paddingX],
      paddingYMap[paddingY],
      centered && 'mx-auto',
      className
    );

    const animationVariants: any = {
      initial: { opacity: 0, y: 20 },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
        },
      },
    };

    const Component = motion[as];

    if (animate) {
      return (
        <Component
          ref={ref}
          className={containerClasses}
          style={style}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-100px' }}
          variants={animationVariants}
          {...props}
        >
          {children}
        </Component>
      );
    }

    return (
      <Component
        ref={ref}
        className={containerClasses}
        style={style}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Container.displayName = 'Container';

// Fluid container with responsive edges
interface FluidContainerProps extends Omit<ContainerProps, 'size'> {
  /** Fluid edge style on larger screens */
  fluidEdges?: boolean;
}

export const FluidContainer = forwardRef<HTMLDivElement, FluidContainerProps>(
  ({ children, fluidEdges = true, className, ...props }, ref) => {
    return (
      <Container
        ref={ref}
        size="full"
        className={cn(
          fluidEdges && 'lg:px-[5vw] xl:px-[8vw]',
          className
        )}
        {...props}
      >
        {children}
      </Container>
    );
  }
);

FluidContainer.displayName = 'FluidContainer';

export type { ContainerProps, ContainerSize, PaddingSize, FluidContainerProps };
