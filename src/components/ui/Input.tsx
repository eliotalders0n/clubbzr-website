import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

type InputState = 'default' | 'error' | 'success';

interface BaseInputProps {
  label?: string;
  error?: string;
  success?: string;
  state?: InputState;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// Text Input
interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, BaseInputProps {
  size?: 'sm' | 'md' | 'lg';
}

const inputSizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-5 py-4 text-lg',
};

const stateStyles: Record<InputState, string> = {
  default: 'border-bzr-gray-700 focus:border-bzr-blue',
  error: 'border-red-500 focus:border-red-500',
  success: 'border-bzr-green focus:border-bzr-green',
};

const Input = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      error,
      success,
      state: stateProp,
      size = 'md',
      leftIcon,
      rightIcon,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(Boolean(props.value || props.defaultValue));
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const state = stateProp || (error ? 'error' : success ? 'success' : 'default');
    const message = error || success;

    return (
      <div className="relative w-full">
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-bzr-gray-400 z-10">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-bzr-gray-900/50 text-bzr-white rounded-lg',
              'border-2 transition-all duration-300 ease-expo-out',
              'placeholder:text-transparent',
              'focus:outline-none focus:ring-0',
              'focus:shadow-[0_0_20px_rgba(0,102,255,0.2)]',
              stateStyles[state],
              inputSizes[size],
              leftIcon && 'pl-12',
              rightIcon && 'pr-12',
              label && 'pt-6 pb-2',
              className
            )}
            placeholder={label || ' '}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(e.target.value.length > 0);
              props.onChange?.(e);
            }}
            aria-invalid={state === 'error'}
            aria-describedby={message ? `${inputId}-message` : undefined}
            {...props}
          />

          {label && (
            <motion.label
              htmlFor={inputId}
              className={cn(
                'absolute left-4 pointer-events-none',
                'text-bzr-gray-400 transition-all duration-200 ease-expo-out',
                leftIcon && 'left-12'
              )}
              initial={false}
              animate={{
                y: isFocused || hasValue ? -8 : 0,
                scale: isFocused || hasValue ? 0.75 : 1,
                originX: 0,
              }}
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              {label}
            </motion.label>
          )}

          {rightIcon && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-bzr-gray-400 z-10">
              {rightIcon}
            </span>
          )}
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              id={`${inputId}-message`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                'mt-2 text-sm',
                error ? 'text-red-500' : 'text-bzr-green'
              )}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea with auto-resize
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      success,
      state: stateProp,
      autoResize = true,
      minRows = 3,
      maxRows = 10,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(Boolean(props.value || props.defaultValue));
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const state = stateProp || (error ? 'error' : success ? 'success' : 'default');
    const message = error || success;

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea || !autoResize) return;

      textarea.style.height = 'auto';
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    };

    useEffect(() => {
      adjustHeight();
    }, [props.value]);

    return (
      <div className="relative w-full">
        <div className="relative">
          <textarea
            ref={(node) => {
              textareaRef.current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            id={inputId}
            rows={minRows}
            className={cn(
              'w-full bg-bzr-gray-900/50 text-bzr-white rounded-lg',
              'border-2 transition-all duration-300 ease-expo-out',
              'placeholder:text-transparent resize-none',
              'focus:outline-none focus:ring-0',
              'focus:shadow-[0_0_20px_rgba(0,102,255,0.2)]',
              'px-4 py-3',
              stateStyles[state],
              label && 'pt-6',
              className
            )}
            placeholder={label || ' '}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(e.target.value.length > 0);
              adjustHeight();
              props.onChange?.(e);
            }}
            aria-invalid={state === 'error'}
            aria-describedby={message ? `${inputId}-message` : undefined}
            {...props}
          />

          {label && (
            <motion.label
              htmlFor={inputId}
              className="absolute left-4 top-4 pointer-events-none text-bzr-gray-400"
              initial={false}
              animate={{
                y: isFocused || hasValue ? -8 : 0,
                scale: isFocused || hasValue ? 0.75 : 1,
                originX: 0,
              }}
            >
              {label}
            </motion.label>
          )}
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              id={`${inputId}-message`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                'mt-2 text-sm',
                error ? 'text-red-500' : 'text-bzr-green'
              )}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Password Input
interface PasswordInputProps extends Omit<TextInputProps, 'type'> {}

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 hover:text-bzr-white transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
        {...props}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

// Search Input
interface SearchInputProps extends Omit<TextInputProps, 'leftIcon'> {
  onSearch?: (value: string) => void;
}

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        leftIcon={<SearchIcon />}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) {
            onSearch((e.target as HTMLInputElement).value);
          }
          props.onKeyDown?.(e);
        }}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

export {
  Input,
  Textarea,
  PasswordInput,
  SearchInput,
  type TextInputProps,
  type TextareaProps,
  type PasswordInputProps,
  type SearchInputProps,
};
