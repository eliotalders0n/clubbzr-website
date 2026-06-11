import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Context
interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

const useDropdown = () => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a Dropdown');
  }
  return context;
};

// Root component
interface DropdownProps {
  children: ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
}

export function Dropdown({ children, onOpenChange }: DropdownProps) {
  const [isOpen, setIsOpenState] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setIsOpen = useCallback((value: boolean) => {
    setIsOpenState(value);
    onOpenChange?.(value);
    if (!value) {
      setActiveIndex(-1);
    }
  }, [onOpenChange]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, setIsOpen]);

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        setIsOpen,
        activeIndex,
        setActiveIndex,
        triggerRef,
        menuRef,
      }}
    >
      <div className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

// Trigger
interface DropdownTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownTrigger = forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, className, ...props }, _ref) => {
    const { isOpen, setIsOpen, triggerRef, menuRef, setActiveIndex } = useDropdown();

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        setActiveIndex(0);
        // Focus first item
        requestAnimationFrame(() => {
          const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
          firstItem?.focus();
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        // Focus last item
        requestAnimationFrame(() => {
          const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
          if (items?.length) {
            setActiveIndex(items.length - 1);
            items[items.length - 1].focus();
          }
        });
      }
    };

    return (
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'px-4 py-2 rounded-lg',
          'bg-bzr-gray-800 text-bzr-white',
          'border border-bzr-gray-700',
          'hover:bg-bzr-gray-700',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-bzr-blue',
          'transition-colors duration-200',
          className
        )}
        {...props}
      >
        {children}
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
    );
  }
);

DropdownTrigger.displayName = 'DropdownTrigger';

// Menu
interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end' | 'center';
}

const menuVariants: any = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -8,
    transition: {
      duration: 0.15,
    },
  },
};

const alignments = {
  start: 'left-0',
  end: 'right-0',
  center: 'left-1/2 -translate-x-1/2',
};

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ align = 'start', className, children, ...props }, _ref) => {
    const { isOpen, menuRef, setActiveIndex, setIsOpen, triggerRef } = useDropdown();

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
      if (!items?.length) return;

      const currentIndex = Array.from(items).findIndex(
        (item) => item === document.activeElement
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        setActiveIndex(nextIndex);
        items[nextIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        setActiveIndex(prevIndex);
        items[prevIndex].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(items.length - 1);
        items[items.length - 1].focus();
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            tabIndex={-1}
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleKeyDown}
            className={cn(
              'absolute z-50 mt-2 min-w-[180px]',
              'py-2 rounded-xl',
              'bg-bzr-gray-900 border border-bzr-gray-800',
              'shadow-xl shadow-bzr-black/50',
              'overflow-hidden',
              alignments[align],
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

DropdownMenu.displayName = 'DropdownMenu';

// Item
type DropdownItemVariant = 'default' | 'danger';

interface DropdownItemProps extends HTMLAttributes<HTMLDivElement> {
  variant?: DropdownItemVariant;
  disabled?: boolean;
  icon?: ReactNode;
  shortcut?: string;
}

const itemVariants: Record<DropdownItemVariant, string> = {
  default: 'text-bzr-white hover:bg-bzr-gray-800 focus:bg-bzr-gray-800',
  danger: 'text-red-500 hover:bg-red-500/10 focus:bg-red-500/10',
};

export const DropdownItem = forwardRef<HTMLDivElement, DropdownItemProps>(
  (
    {
      variant = 'default',
      disabled = false,
      icon,
      shortcut,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { setIsOpen } = useDropdown();

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onClick?.(e);
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
        setIsOpen(false);
      }
    };

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-3 px-4 py-2',
          'cursor-pointer select-none',
          'transition-colors duration-150',
          'focus:outline-none',
          itemVariants[variant],
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {icon && <span className="w-5 h-5 flex items-center justify-center">{icon}</span>}
        <span className="flex-1">{children}</span>
        {shortcut && (
          <span className="text-xs text-bzr-gray-500 font-mono">{shortcut}</span>
        )}
      </div>
    );
  }
);

DropdownItem.displayName = 'DropdownItem';

// Separator
export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn('my-1 h-px bg-bzr-gray-800', className)}
    />
  );
}

// Label
export function DropdownLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-4 py-2 text-xs font-semibold uppercase tracking-wider text-bzr-gray-500',
        className
      )}
    >
      {children}
    </div>
  );
}

export type {
  DropdownProps,
  DropdownTriggerProps,
  DropdownMenuProps,
  DropdownItemProps,
};
