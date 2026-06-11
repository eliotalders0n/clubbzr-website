import { forwardRef, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

type LoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Spinner
interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: LoaderSize;
  color?: 'blue' | 'white' | 'green' | 'current';
}

const spinnerSizes: Record<LoaderSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const spinnerColors = {
  blue: 'text-bzr-blue',
  white: 'text-bzr-white',
  green: 'text-bzr-green',
  current: 'text-current',
};

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', color = 'blue', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn('relative', spinnerSizes[size], spinnerColors[color], className)}
        {...props}
      >
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-full h-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </motion.svg>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

// Dots Animation
interface DotsLoaderProps extends HTMLAttributes<HTMLDivElement> {
  size?: LoaderSize;
  color?: 'blue' | 'white' | 'green' | 'current';
}

const dotSizes: Record<LoaderSize, string> = {
  xs: 'w-1 h-1',
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

const dotGaps: Record<LoaderSize, string> = {
  xs: 'gap-1',
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
  xl: 'gap-3',
};

export const DotsLoader = forwardRef<HTMLDivElement, DotsLoaderProps>(
  ({ size = 'md', color = 'blue', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn('flex items-center', dotGaps[size], spinnerColors[color], className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={cn('rounded-full bg-current', dotSizes[size])}
            animate={{
              y: [0, -8, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.1,
              ease: 'easeInOut',
            }}
          />
        ))}
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

DotsLoader.displayName = 'DotsLoader';

// Skeleton Loader
interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'text',
      width,
      height,
      lines = 1,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'bg-bzr-gray-800 animate-pulse';

    const variantClasses = {
      text: 'rounded h-4',
      circular: 'rounded-full',
      rectangular: 'rounded-none',
      rounded: 'rounded-lg',
    };

    if (variant === 'text' && lines > 1) {
      return (
        <div ref={ref} className={cn('space-y-2', className)} {...props}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={cn(baseClasses, variantClasses.text)}
              style={{
                width: i === lines - 1 ? '60%' : '100%',
                ...style,
              }}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        style={{
          width: width || (variant === 'circular' ? height : '100%'),
          height: height || (variant === 'text' ? '1rem' : '100%'),
          ...style,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Progress Bar
interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'orange';
  showValue?: boolean;
}

const progressSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const progressColors = {
  blue: 'bg-bzr-blue',
  green: 'bg-bzr-green',
  orange: 'bg-bzr-orange',
};

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value = 0,
      max = 100,
      indeterminate = false,
      size = 'md',
      color = 'blue',
      showValue = false,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        <div
          className={cn(
            'w-full rounded-full bg-bzr-gray-800 overflow-hidden',
            progressSizes[size]
          )}
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          {indeterminate ? (
            <motion.div
              className={cn('h-full w-1/3 rounded-full', progressColors[color])}
              animate={{
                x: ['-100%', '400%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ) : (
            <motion.div
              className={cn('h-full rounded-full', progressColors[color])}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </div>

        {showValue && !indeterminate && (
          <p className="mt-1 text-sm text-bzr-gray-400 text-right">
            {Math.round(percentage)}%
          </p>
        )}
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

// Full Page Loader
interface PageLoaderProps extends HTMLAttributes<HTMLDivElement> {
  logo?: React.ReactNode;
  text?: string;
}

export const PageLoader = forwardRef<HTMLDivElement, PageLoaderProps>(
  ({ logo, text = 'Loading...', className }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 z-[999]',
          'flex flex-col items-center justify-center gap-8',
          'bg-bzr-black',
          className
        )}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-bzr-blue/5 via-transparent to-transparent" />

        {/* Logo or default */}
        {logo || (
          <motion.div
            className="relative"
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <div className="text-display-md font-display font-bold text-bzr-white tracking-tighter">
              BZR
            </div>
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 blur-xl bg-bzr-blue/30"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-4">
          <DotsLoader size="lg" color="white" />
          <motion.p
            className="text-bzr-gray-400 text-sm font-mono"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {text}
          </motion.p>
        </div>
      </motion.div>
    );
  }
);

PageLoader.displayName = 'PageLoader';

// Card Skeleton for common use case
interface CardSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  showImage?: boolean;
  lines?: number;
}

export const CardSkeleton = forwardRef<HTMLDivElement, CardSkeletonProps>(
  ({ showImage = true, lines = 3, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border border-bzr-gray-800 bg-bzr-gray-900 p-6',
          className
        )}
        {...props}
      >
        {showImage && (
          <Skeleton
            variant="rounded"
            height={200}
            className="mb-4"
          />
        )}
        <Skeleton variant="text" className="w-2/3 h-6 mb-3" />
        <Skeleton variant="text" lines={lines} />
      </div>
    );
  }
);

CardSkeleton.displayName = 'CardSkeleton';

export type {
  SpinnerProps,
  DotsLoaderProps,
  SkeletonProps,
  ProgressBarProps,
  PageLoaderProps,
  CardSkeletonProps,
  LoaderSize,
};
