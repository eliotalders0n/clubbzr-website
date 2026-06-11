'use client';

import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '../../utils/cn';

// Sidebar navigation item type
export interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children?: SidebarItem[];
}

// Sidebar section type
export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface SidebarProps {
  /** Sidebar sections */
  sections: SidebarSection[];
  /** Is sidebar collapsed */
  collapsed?: boolean;
  /** Toggle collapse handler */
  onToggleCollapse?: () => void;
  /** Logo element or image source */
  logo?: React.ReactNode | string;
  /** Logo alt text (if logo is string) */
  logoAlt?: string;
  /** Show collapse toggle */
  showToggle?: boolean;
  /** Custom className */
  className?: string;
  /** Header content */
  header?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
}

// Animation variants
const sidebarVariants: Variants = {
  expanded: {
    width: 280,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  collapsed: {
    width: 72,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const itemVariants: Variants = {
  expanded: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  collapsed: {
    opacity: 0,
    x: -10,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// Sidebar Item Component
const SidebarNavItem: React.FC<{
  item: SidebarItem;
  collapsed: boolean;
  depth?: number;
}> = ({ item, collapsed, depth = 0 }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
  const isChildActive = item.children?.some(
    (child) => location.pathname === child.href || location.pathname.startsWith(child.href + '/')
  );

  const handleClick = useCallback(() => {
    if (hasChildren) {
      setIsExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  const itemContent = (
    <>
      {/* Icon */}
      {item.icon && (
        <span className={cn(
          'flex-shrink-0 w-5 h-5 flex items-center justify-center',
          isActive || isChildActive ? 'text-bzr-blue' : 'text-bzr-gray-400'
        )}>
          {item.icon}
        </span>
      )}

      {/* Label */}
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={itemVariants}
            className={cn(
              'flex-1 text-sm font-medium truncate',
              isActive || isChildActive ? 'text-bzr-white' : 'text-bzr-gray-400'
            )}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Badge */}
      {item.badge && !collapsed && (
        <motion.span
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          variants={itemVariants}
          className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-bzr-blue/10 text-bzr-blue"
        >
          {item.badge}
        </motion.span>
      )}

      {/* Expand Arrow (for items with children) */}
      {hasChildren && !collapsed && (
        <motion.svg
          className="w-4 h-4 text-bzr-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      )}
    </>
  );

  const itemClasses = cn(
    'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
    depth > 0 && 'ml-6',
    collapsed && 'justify-center px-2',
    isActive
      ? 'bg-bzr-gray-800 text-bzr-white'
      : 'text-bzr-gray-400 hover:bg-bzr-gray-800/50 hover:text-bzr-white'
  );

  return (
    <div>
      {hasChildren ? (
        <button onClick={handleClick} className={cn(itemClasses, 'w-full')}>
          {itemContent}
        </button>
      ) : (
        <Link to={item.href} className={itemClasses}>
          {/* Active indicator */}
          {isActive && (
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-bzr-blue rounded-r-full"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
          {itemContent}
        </Link>
      )}

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && !collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1 space-y-1">
              {item.children!.map((child) => (
                <SidebarNavItem
                  key={child.href}
                  item={child}
                  collapsed={collapsed}
                  depth={depth + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  collapsed = false,
  onToggleCollapse,
  logo,
  logoAlt = 'Logo',
  showToggle = true,
  className,
  header,
  footer,
}) => {
  return (
    <motion.aside
      className={cn(
        'h-screen flex flex-col bg-bzr-gray-900 border-r border-bzr-gray-800 overflow-hidden',
        className
      )}
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
    >
      {/* Header / Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-bzr-gray-800',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          {typeof logo === 'string' ? (
            <img
              src={logo}
              alt={logoAlt}
              className={cn(
                'h-8 w-auto transition-all',
                collapsed && 'h-8'
              )}
            />
          ) : logo ? (
            logo
          ) : (
            <>
              <span className="w-8 h-8 rounded-lg bg-bzr-blue flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">B</span>
              </span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    variants={itemVariants}
                    className="font-display text-lg font-bold text-bzr-white whitespace-nowrap"
                  >
                    Club BZR
                  </motion.span>
                )}
              </AnimatePresence>
            </>
          )}
        </Link>

        {/* Toggle Button */}
        {showToggle && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-2 text-bzr-gray-400 hover:text-bzr-white hover:bg-bzr-gray-800 rounded-lg transition-colors"
            aria-label="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand Button (when collapsed) */}
      {showToggle && collapsed && (
        <button
          onClick={onToggleCollapse}
          className="mx-auto mt-4 p-2 text-bzr-gray-400 hover:text-bzr-white hover:bg-bzr-gray-800 rounded-lg transition-colors"
          aria-label="Expand sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Custom Header Content */}
      {header && (
        <div className={cn('px-4 py-4 border-b border-bzr-gray-800', collapsed && 'px-2')}>
          {header}
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-bzr-gray-700">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {/* Section Title */}
            {section.title && !collapsed && (
              <motion.h3
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={itemVariants}
                className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-bzr-gray-500"
              >
                {section.title}
              </motion.h3>
            )}

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Content */}
      {footer && (
        <div className={cn(
          'px-4 py-4 border-t border-bzr-gray-800',
          collapsed && 'px-2'
        )}>
          {footer}
        </div>
      )}
    </motion.aside>
  );
};

// Mobile Sidebar Wrapper with overlay
interface MobileSidebarProps extends SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  ...props
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-bzr-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-0 top-0 h-screen z-50 lg:hidden"
          >
            <Sidebar {...props} collapsed={false} showToggle={false} />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-bzr-gray-400 hover:text-bzr-white hover:bg-bzr-gray-800 rounded-lg transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export type { SidebarProps, MobileSidebarProps };
