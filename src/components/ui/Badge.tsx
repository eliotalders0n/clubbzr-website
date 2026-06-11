import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

type BadgeVariant = 'blue' | 'green' | 'orange' | 'lavender' | 'gray' | 'outline';
type BadgeSize = 'sm' | 'md';
type BadgeShape = 'pill' | 'square';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  shape?: BadgeShape;
  icon?: ReactNode;
  interactive?: boolean;
  onRemove?: () => void;
}

const variants: Record<BadgeVariant, string> = {
  blue: 'bg-bzr-blue/20 text-bzr-blue border-bzr-blue/30',
  green: 'bg-bzr-green/20 text-bzr-green border-bzr-green/30',
  orange: 'bg-bzr-orange/20 text-bzr-orange border-bzr-orange/30',
  lavender: 'bg-bzr-lavender/20 text-bzr-lavender border-bzr-lavender/30',
  gray: 'bg-bzr-gray-700/50 text-bzr-gray-300 border-bzr-gray-600',
  outline: 'bg-transparent text-bzr-white border-bzr-gray-600 hover:border-bzr-white',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
};

const shapes: Record<BadgeShape, string> = {
  pill: 'rounded-full',
  square: 'rounded-md',
};

const CloseIcon = ({ size }: { size: BadgeSize }) => (
  <svg
    width={size === 'sm' ? 12 : 14}
    height={size === 'sm' ? 12 : 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="flex-shrink-0"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'blue',
      size = 'md',
      shape = 'pill',
      icon,
      interactive = false,
      onRemove,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const isClickable = interactive || Boolean(onClick);

    const badgeContent = (
      <>
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Remove"
          >
            <CloseIcon size={size} />
          </button>
        )}
      </>
    );

    if (isClickable) {
      return (
        <motion.span
          ref={ref}
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.(e as unknown as React.MouseEvent<HTMLSpanElement>);
            }
          }}
          className={cn(
            'inline-flex items-center justify-center',
            'font-medium border',
            'transition-all duration-200',
            'cursor-pointer select-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-bzr-blue focus-visible:ring-offset-1 focus-visible:ring-offset-bzr-black',
            variants[variant],
            sizes[size],
            shapes[shape],
            className
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          {...(props as any)}
        >
          {badgeContent}
        </motion.span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center',
          'font-medium border',
          variants[variant],
          sizes[size],
          shapes[shape],
          className
        )}
        {...props}
      >
        {badgeContent}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Badge Group for displaying multiple badges
interface BadgeGroupProps extends HTMLAttributes<HTMLDivElement> {
  gap?: 'sm' | 'md' | 'lg';
}

const gaps = {
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
};

const BadgeGroup = forwardRef<HTMLDivElement, BadgeGroupProps>(
  ({ gap = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-wrap items-center', gaps[gap], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

BadgeGroup.displayName = 'BadgeGroup';

export {
  Badge,
  BadgeGroup,
  type BadgeProps,
  type BadgeGroupProps,
  type BadgeVariant,
  type BadgeSize,
  type BadgeShape,
};
