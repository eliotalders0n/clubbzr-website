import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

const variants: Record<ButtonVariant, string> = {
  primary: `
    bg-bzr-blue text-bzr-white
    hover:bg-bzr-blue/90
    shadow-glow-blue hover:shadow-[0_0_60px_rgba(0,102,255,0.4)]
    active:scale-[0.98]
  `,
  secondary: `
    bg-transparent border-2 border-bzr-white text-bzr-white
    hover:bg-bzr-white hover:text-bzr-black
    active:scale-[0.98]
  `,
  ghost: `
    bg-transparent text-bzr-white
    hover:bg-bzr-white/10
    active:bg-bzr-white/20
  `,
  icon: `
    bg-bzr-gray-800 text-bzr-white
    hover:bg-bzr-gray-700
    active:scale-[0.95]
    aspect-square !p-0
  `,
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm min-h-[36px]',
  md: 'px-6 py-3 text-base min-h-[44px]',
  lg: 'px-8 py-4 text-lg min-h-[52px]',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
};

const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={cn('animate-spin', className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const isIconButton = variant === 'icon';

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          // Base styles
          'relative inline-flex items-center justify-center gap-2',
          'font-display font-semibold tracking-wide uppercase',
          'rounded-lg',
          'transition-all duration-300 ease-expo-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-bzr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bzr-black',
          // Variant styles
          variants[variant],
          // Size styles
          isIconButton ? iconSizes[size] : sizes[size],
          // Disabled styles
          isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
        {...(props as any)}
      >
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner className="w-5 h-5" />
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-2',
            isLoading && 'opacity-0'
          )}
        >
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </span>
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
