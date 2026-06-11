import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Base Card
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
  glow?: 'blue' | 'green' | 'orange' | false;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingSizes = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const glowColors = {
  blue: 'hover:shadow-glow-blue',
  green: 'hover:shadow-glow-green',
  orange: 'hover:shadow-glow-orange',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      glass = false,
      hover = false,
      glow = false,
      padding = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl',
          'border border-bzr-gray-800',
          'transition-all duration-500 ease-expo-out',
          glass
            ? 'bg-bzr-gray-900/30 backdrop-blur-xl'
            : 'bg-bzr-gray-900',
          hover && 'hover:-translate-y-1',
          glow && glowColors[glow],
          paddingSizes[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Image Card
interface ImageCardProps extends Omit<CardProps, 'children'> {
  src: string;
  alt: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'wide';
  overlay?: boolean;
  children?: ReactNode;
}

const aspectRatios = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  wide: 'aspect-[2/1]',
};

const ImageCard = forwardRef<HTMLDivElement, ImageCardProps>(
  (
    {
      src,
      alt,
      aspectRatio = 'video',
      overlay = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'border border-bzr-gray-800',
          'group cursor-pointer',
          aspectRatios[aspectRatio],
          className
        )}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        {...(props as any)}
      >
        <motion.img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        {overlay && (
          <div className="absolute inset-0 bg-gradient-to-t from-bzr-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
        )}

        {children && (
          <div className="absolute inset-0 p-6 flex flex-col justify-end">
            {children}
          </div>
        )}

        {/* Hover border glow */}
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-bzr-blue/50 transition-colors duration-300 pointer-events-none" />
      </motion.div>
    );
  }
);

ImageCard.displayName = 'ImageCard';

// Feature Card
interface FeatureCardProps extends CardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const FeatureCard = forwardRef<HTMLDivElement, FeatureCardProps>(
  (
    {
      icon,
      title,
      description,
      glass = true,
      hover = true,
      glow = 'blue',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        glass={glass}
        hover={hover}
        glow={glow}
        className={cn('group', className)}
        {...props}
      >
        <div className="mb-4">
          <motion.div
            className="w-14 h-14 rounded-xl bg-bzr-blue/10 flex items-center justify-center text-bzr-blue"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {icon}
          </motion.div>
        </div>

        <h3 className="text-xl font-display font-semibold text-bzr-white mb-2 group-hover:text-bzr-blue transition-colors duration-300">
          {title}
        </h3>

        <p className="text-bzr-gray-400 leading-relaxed">
          {description}
        </p>
      </Card>
    );
  }
);

FeatureCard.displayName = 'FeatureCard';

// Interactive Card
interface InteractiveCardProps extends Omit<CardProps, 'onClick'> {
  onClick?: () => void;
  disabled?: boolean;
}

const InteractiveCard = forwardRef<HTMLDivElement, InteractiveCardProps>(
  (
    {
      onClick,
      disabled = false,
      hover = true,
      glow = 'blue',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          'rounded-2xl',
          'border border-bzr-gray-800',
          'transition-all duration-500 ease-expo-out',
          'bg-bzr-gray-900/30 backdrop-blur-xl',
          'cursor-pointer select-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-bzr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bzr-black',
          hover && !disabled && 'hover:-translate-y-1',
          glow && !disabled && glowColors[glow],
          disabled && 'opacity-50 cursor-not-allowed',
          props.padding ? paddingSizes[props.padding] : paddingSizes.md,
          className
        )}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        aria-disabled={disabled}
      >
        {children}
      </motion.div>
    );
  }
);

InteractiveCard.displayName = 'InteractiveCard';

export {
  Card,
  ImageCard,
  FeatureCard,
  InteractiveCard,
  type CardProps,
  type ImageCardProps,
  type FeatureCardProps,
  type InteractiveCardProps,
};
