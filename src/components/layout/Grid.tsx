'use client';

import React, {
  forwardRef,
  ReactNode,
  CSSProperties,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

// Column count options
type ColumnCount = 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'auto';

// Gap size options
type GapSize = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Grid props
interface GridProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Number of columns */
  cols?: ColumnCount;
  /** Columns on tablet (md) */
  colsMd?: ColumnCount;
  /** Columns on desktop (lg) */
  colsLg?: ColumnCount;
  /** Gap between items */
  gap?: GapSize;
  /** Row gap (if different from column gap) */
  rowGap?: GapSize;
  /** Column gap */
  colGap?: GapSize;
  /** Align items */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Justify items */
  justify?: 'start' | 'center' | 'end' | 'stretch';
  /** Enable staggered animation on children */
  stagger?: boolean;
  /** Stagger delay between items */
  staggerDelay?: number;
  /** Custom className */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
}

// Column count mapping
const colsMap: Record<ColumnCount, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
  auto: 'grid-cols-[repeat(auto-fit,minmax(280px,1fr))]',
};

const colsMdMap: Record<ColumnCount, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
  12: 'md:grid-cols-12',
  auto: 'md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]',
};

const colsLgMap: Record<ColumnCount, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  12: 'lg:grid-cols-12',
  auto: 'lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]',
};

// Gap mapping
const gapMap: Record<GapSize, string> = {
  none: 'gap-0',
  xs: 'gap-2',
  sm: 'gap-4',
  md: 'gap-6 md:gap-8',
  lg: 'gap-8 md:gap-12',
  xl: 'gap-12 md:gap-16 lg:gap-20',
};

const rowGapMap: Record<GapSize, string> = {
  none: 'gap-y-0',
  xs: 'gap-y-2',
  sm: 'gap-y-4',
  md: 'gap-y-6 md:gap-y-8',
  lg: 'gap-y-8 md:gap-y-12',
  xl: 'gap-y-12 md:gap-y-16 lg:gap-y-20',
};

const colGapMap: Record<GapSize, string> = {
  none: 'gap-x-0',
  xs: 'gap-x-2',
  sm: 'gap-x-4',
  md: 'gap-x-6 md:gap-x-8',
  lg: 'gap-x-8 md:gap-x-12',
  xl: 'gap-x-12 md:gap-x-16 lg:gap-x-20',
};

// Align mapping
const alignMap: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

// Justify mapping
const justifyMap: Record<string, string> = {
  start: 'justify-items-start',
  center: 'justify-items-center',
  end: 'justify-items-end',
  stretch: 'justify-items-stretch',
};

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  (
    {
      children,
      cols = 1,
      colsMd,
      colsLg,
      gap = 'md',
      rowGap,
      colGap,
      align = 'stretch',
      justify = 'stretch',
      stagger = false,
      staggerDelay = 0.1,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const gridClasses = cn(
      'grid',
      colsMap[cols],
      colsMd && colsMdMap[colsMd],
      colsLg && colsLgMap[colsLg],
      !rowGap && !colGap && gapMap[gap],
      rowGap && rowGapMap[rowGap],
      colGap && colGapMap[colGap],
      alignMap[align],
      justifyMap[justify],
      className
    );

    const containerVariants: any = {
      hidden: {},
      visible: {
        transition: {
          staggerChildren: staggerDelay,
          delayChildren: 0.1,
        },
      },
    };

    if (stagger) {
      return (
        <motion.div
          ref={ref}
          className={gridClasses}
          style={style}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={containerVariants}
          {...props}
        >
          {React.Children.map(children, (child, index) => {
            if (React.isValidElement(child)) {
              return (
                <motion.div
                  key={index}
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.6,
                        ease: [0.16, 1, 0.3, 1],
                      },
                    },
                  }}
                >
                  {child}
                </motion.div>
              );
            }
            return child;
          })}
        </motion.div>
      );
    }

    return (
      <motion.div
        ref={ref}
        className={gridClasses}
        style={style}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Grid.displayName = 'Grid';

// Grid Item for spanning columns/rows
interface GridItemProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Column span */
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'full';
  /** Column span on md */
  colSpanMd?: 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'full';
  /** Column span on lg */
  colSpanLg?: 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'full';
  /** Row span */
  rowSpan?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Custom className */
  className?: string;
}

const colSpanMap: Record<string | number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  12: 'col-span-12',
  full: 'col-span-full',
};

const colSpanMdMap: Record<string | number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  12: 'md:col-span-12',
  full: 'md:col-span-full',
};

const colSpanLgMap: Record<string | number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  12: 'lg:col-span-12',
  full: 'lg:col-span-full',
};

const rowSpanMap: Record<number, string> = {
  1: 'row-span-1',
  2: 'row-span-2',
  3: 'row-span-3',
  4: 'row-span-4',
  5: 'row-span-5',
  6: 'row-span-6',
};

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  (
    {
      children,
      colSpan,
      colSpanMd,
      colSpanLg,
      rowSpan,
      className,
      ...props
    },
    ref
  ) => {
    const itemClasses = cn(
      colSpan && colSpanMap[colSpan],
      colSpanMd && colSpanMdMap[colSpanMd],
      colSpanLg && colSpanLgMap[colSpanLg],
      rowSpan && rowSpanMap[rowSpan],
      className
    );

    return (
      <motion.div ref={ref} className={itemClasses} {...props}>
        {children}
      </motion.div>
    );
  }
);

GridItem.displayName = 'GridItem';

// Masonry Grid Component
interface MasonryGridProps {
  children: ReactNode;
  /** Number of columns */
  columns?: number;
  /** Columns on tablet */
  columnsMd?: number;
  /** Columns on desktop */
  columnsLg?: number;
  /** Gap between items in pixels */
  gap?: number;
  /** Enable animations */
  animate?: boolean;
  /** Custom className */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
}

interface MasonryItem {
  element: ReactNode;
  index: number;
  height: number;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  children,
  columns = 2,
  columnsMd = 3,
  columnsLg = 4,
  gap = 16,
  animate = true,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(columns);
  const [items, setItems] = useState<MasonryItem[]>([]);

  // Determine column count based on viewport
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setColumnCount(columnsLg);
      } else if (width >= 768) {
        setColumnCount(columnsMd);
      } else {
        setColumnCount(columns);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [columns, columnsMd, columnsLg]);

  // Initialize items
  useEffect(() => {
    const childArray = React.Children.toArray(children);
    setItems(
      childArray.map((child, index) => ({
        element: child,
        index,
        height: 0,
      }))
    );
  }, [children]);

  // Distribute items into columns
  const distributeItems = useCallback(() => {
    const columnHeights = new Array(columnCount).fill(0);
    const columnItems: ReactNode[][] = new Array(columnCount).fill(null).map(() => []);

    items.forEach((item, index) => {
      // Find shortest column
      const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
      columnItems[shortestColumn].push(
        <motion.div
          key={item.index}
          initial={animate ? { opacity: 0, y: 20 } : undefined}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{
            duration: 0.5,
            delay: index * 0.05,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ marginBottom: gap }}
        >
          {item.element}
        </motion.div>
      );
      // Add estimated height (will be updated after render)
      columnHeights[shortestColumn] += 300;
    });

    return columnItems;
  }, [items, columnCount, gap, animate]);

  const columnItems = distributeItems();

  return (
    <div
      ref={containerRef}
      className={cn('flex', className)}
      style={{
        gap,
        ...style,
      }}
    >
      {columnItems.map((column, colIndex) => (
        <div
          key={colIndex}
          className="flex-1"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {column}
        </div>
      ))}
    </div>
  );
};

// Auto-fit Grid - automatically sizes columns to fit content
interface AutoGridProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Minimum item width */
  minItemWidth?: number | string;
  /** Maximum item width */
  maxItemWidth?: string;
  /** Gap between items */
  gap?: GapSize;
  /** Custom className */
  className?: string;
}

export const AutoGrid = forwardRef<HTMLDivElement, AutoGridProps>(
  (
    {
      children,
      minItemWidth = 280,
      maxItemWidth = '1fr',
      gap = 'md',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const minWidth = typeof minItemWidth === 'number' ? `${minItemWidth}px` : minItemWidth;

    return (
      <motion.div
        ref={ref}
        className={cn('grid', gapMap[gap], className)}
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, ${maxItemWidth}))`,
          ...style,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AutoGrid.displayName = 'AutoGrid';

export type {
  GridProps,
  GridItemProps,
  MasonryGridProps,
  AutoGridProps,
  ColumnCount,
  GapSize,
};
