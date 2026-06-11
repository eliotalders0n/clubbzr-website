import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Types
type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'CLEAR_ALL' };

// Icons
const icons: Record<ToastType, ReactNode> = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const styles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-bzr-green/10',
    border: 'border-bzr-green/30',
    icon: 'text-bzr-green',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-500',
  },
  info: {
    bg: 'bg-bzr-blue/10',
    border: 'border-bzr-blue/30',
    icon: 'text-bzr-blue',
  },
  warning: {
    bg: 'bg-bzr-orange/10',
    border: 'border-bzr-orange/30',
    icon: 'text-bzr-orange',
  },
};

// Reducer
function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    case 'CLEAR_ALL':
      return {
        ...state,
        toasts: [],
      };
    default:
      return state;
  }
}

// Context
interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  success: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) => string;
  error: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) => string;
  info: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) => string;
  warning: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Hook
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Generate unique ID
let toastCount = 0;
const generateId = () => `toast-${++toastCount}-${Date.now()}`;

// Provider
interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

const positionStyles: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
}: ToastProviderProps) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId();
    dispatch({
      type: 'ADD_TOAST',
      payload: {
        id,
        duration: 5000,
        dismissible: true,
        ...toast,
      },
    });
    return id;
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const success = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) =>
      addToast({ type: 'success', title, ...options }),
    [addToast]
  );

  const error = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) =>
      addToast({ type: 'error', title, ...options }),
    [addToast]
  );

  const info = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) =>
      addToast({ type: 'info', title, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title'>>) =>
      addToast({ type: 'warning', title, ...options }),
    [addToast]
  );

  // Limit visible toasts
  const visibleToasts = state.toasts.slice(-maxToasts);

  return (
    <ToastContext.Provider
      value={{ toasts: state.toasts, addToast, removeToast, clearAll, success, error, info, warning }}
    >
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <div
            className={cn(
              'fixed z-[100] flex flex-col gap-3',
              positionStyles[position]
            )}
            aria-live="polite"
            aria-label="Notifications"
          >
            <AnimatePresence mode="sync">
              {visibleToasts.map((toast) => (
                <ToastItem
                  key={toast.id}
                  toast={toast}
                  onDismiss={() => removeToast(toast.id)}
                />
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

// Toast Item
interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const toastVariants: any = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.2,
    },
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { type, title, description, duration, dismissible } = toast;

  // Auto dismiss
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'relative w-80 p-4 rounded-xl',
        'border backdrop-blur-xl',
        'shadow-lg shadow-bzr-black/20',
        styles[type].bg,
        styles[type].border
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex-shrink-0 mt-0.5', styles[type].icon)}>
          {icons[type]}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-bzr-white">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-bzr-gray-400">{description}</p>
          )}
        </div>

        {dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded-lg text-bzr-gray-400 hover:text-bzr-white hover:bg-bzr-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {duration && duration > 0 && (
        <motion.div
          className={cn(
            'absolute bottom-0 left-0 h-1 rounded-b-xl',
            type === 'success' && 'bg-bzr-green',
            type === 'error' && 'bg-red-500',
            type === 'info' && 'bg-bzr-blue',
            type === 'warning' && 'bg-bzr-orange'
          )}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

export type { Toast, ToastType, ToastPosition };
