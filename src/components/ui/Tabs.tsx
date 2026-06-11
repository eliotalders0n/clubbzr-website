import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence, type HTMLMotionProps, type Variants } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

// Context
interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  registerTab: (value: string) => void;
  unregisterTab: (value: string) => void;
  tabs: string[];
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs');
  }
  return context;
};

// Root component
interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChange: onChangeProp,
      orientation = 'horizontal',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
    const [tabs, setTabs] = useState<string[]>([]);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const onChange = useCallback((newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChangeProp?.(newValue);
    }, [isControlled, onChangeProp]);

    const registerTab = useCallback((tabValue: string) => {
      setTabs((prev) => (prev.includes(tabValue) ? prev : [...prev, tabValue]));
    }, []);

    const unregisterTab = useCallback((tabValue: string) => {
      setTabs((prev) => prev.filter((t) => t !== tabValue));
    }, []);

    const contextValue = useMemo(
      () => ({ value, onChange, orientation, registerTab, unregisterTab, tabs }),
      [value, onChange, orientation, registerTab, unregisterTab, tabs]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(
            'flex',
            orientation === 'vertical' ? 'flex-row gap-6' : 'flex-col',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

// TabList
type TabListProps = HTMLAttributes<HTMLDivElement>;

export const TabList = forwardRef<HTMLDivElement, TabListProps>(
  ({ className, children, ...props }, ref) => {
    const { orientation, value, onChange, tabs } = useTabs();
    const listRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, top: 0, height: 0 });

    // Update indicator position
    useEffect(() => {
      const list = listRef.current;
      if (!list) return;

      const activeTab = list.querySelector<HTMLElement>(`[data-value="${value}"]`);
      if (!activeTab) return;

      if (orientation === 'horizontal') {
        setIndicatorStyle({
          left: activeTab.offsetLeft,
          width: activeTab.offsetWidth,
          top: 0,
          height: 0,
        });
      } else {
        setIndicatorStyle({
          left: 0,
          width: 0,
          top: activeTab.offsetTop,
          height: activeTab.offsetHeight,
        });
      }
    }, [value, orientation, tabs]);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabs.indexOf(value);
      let newIndex = currentIndex;

      if (orientation === 'horizontal') {
        if (e.key === 'ArrowRight') {
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        } else if (e.key === 'ArrowLeft') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        }
      } else {
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        } else if (e.key === 'ArrowUp') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        }
      }

      if (e.key === 'Home') {
        newIndex = 0;
      } else if (e.key === 'End') {
        newIndex = tabs.length - 1;
      }

      if (newIndex !== currentIndex) {
        e.preventDefault();
        onChange(tabs[newIndex]);
        // Focus the new tab
        const list = listRef.current;
        const newTab = list?.querySelector<HTMLElement>(`[data-value="${tabs[newIndex]}"]`);
        newTab?.focus();
      }
    };

    return (
      <div
        ref={(node) => {
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        role="tablist"
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative',
          orientation === 'horizontal'
            ? 'flex items-center border-b border-bzr-gray-800'
            : 'flex flex-col border-r border-bzr-gray-800 pr-4',
          className
        )}
        {...props}
      >
        {children}

        {/* Animated indicator */}
        <motion.div
          className={cn(
            'absolute bg-bzr-blue',
            orientation === 'horizontal'
              ? 'bottom-0 h-0.5 rounded-full'
              : 'right-0 w-0.5 rounded-full'
          )}
          initial={false}
          animate={
            orientation === 'horizontal'
              ? { left: indicatorStyle.left, width: indicatorStyle.width }
              : { top: indicatorStyle.top, height: indicatorStyle.height }
          }
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      </div>
    );
  }
);

TabList.displayName = 'TabList';

// Tab
interface TabProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  disabled?: boolean;
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(
  ({ value: tabValue, disabled = false, className, children, ...props }, ref) => {
    const { value, onChange, orientation, registerTab, unregisterTab } = useTabs();
    const isActive = value === tabValue;

    useEffect(() => {
      registerTab(tabValue);
      return () => unregisterTab(tabValue);
    }, [tabValue, registerTab, unregisterTab]);

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        data-value={tabValue}
        aria-selected={isActive}
        aria-disabled={disabled}
        tabIndex={isActive ? 0 : -1}
        onClick={() => !disabled && onChange(tabValue)}
        className={cn(
          'relative px-4 py-3',
          'font-medium text-sm',
          'transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-bzr-blue focus-visible:ring-inset',
          isActive
            ? 'text-bzr-white'
            : 'text-bzr-gray-400 hover:text-bzr-white',
          disabled && 'opacity-50 cursor-not-allowed',
          orientation === 'vertical' && 'text-left w-full',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Tab.displayName = 'Tab';

// TabPanels
type TabPanelsProps = HTMLAttributes<HTMLDivElement>;

export const TabPanels = forwardRef<HTMLDivElement, TabPanelsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex-1', className)} {...props}>
        {children}
      </div>
    );
  }
);

TabPanels.displayName = 'TabPanels';

// TabPanel
interface TabPanelProps extends HTMLMotionProps<'div'> {
  value: string;
}

const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -10,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: {
      duration: 0.2,
    },
  },
};

export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(
  ({ value: panelValue, className, children, ...props }, ref) => {
    const { value } = useTabs();
    const isActive = value === panelValue;

    return (
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.div
            ref={ref}
            role="tabpanel"
            tabIndex={0}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn('pt-4 focus:outline-none', className)}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

TabPanel.displayName = 'TabPanel';

export type {
  TabsProps,
  TabListProps,
  TabProps,
  TabPanelsProps,
  TabPanelProps,
};
