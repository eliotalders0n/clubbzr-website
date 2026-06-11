'use client';

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '../../utils/cn';
import { MagneticButton } from '../animations/MagneticButton';

// Navigation link type
export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
  icon?: React.ReactNode;
}

// User type
interface User {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

// Desktop Navigation Props
interface NavigationProps {
  links: NavLink[];
  className?: string;
}

// Navigation link with animated underline
const NavItem: React.FC<{
  link: NavLink;
  isActive: boolean;
}> = ({ link, isActive }) => {
  const linkContent = (
    <span className="relative py-2 px-1">
      <span className={cn(
        'text-sm font-medium transition-colors',
        isActive ? 'text-bzr-white' : 'text-bzr-gray-400 hover:text-bzr-white'
      )}>
        {link.label}
      </span>

      {/* Animated underline */}
      <motion.span
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-bzr-blue rounded-full"
        initial={false}
        animate={{
          scaleX: isActive ? 1 : 0,
          opacity: isActive ? 1 : 0,
        }}
        whileHover={{
          scaleX: 1,
          opacity: 0.5,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ originX: 0 }}
      />
    </span>
  );

  return (
    <MagneticButton strength={0.1} scale={1.02}>
      {link.external ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-2"
        >
          {linkContent}
        </a>
      ) : (
        <Link to={link.href} className="block px-3 py-2">
          {linkContent}
        </Link>
      )}
    </MagneticButton>
  );
};

// Desktop Navigation
export const Navigation: React.FC<NavigationProps> = ({ links, className }) => {
  const location = useLocation();

  return (
    <nav className={cn('flex items-center gap-1', className)}>
      {links.map((link) => (
        <NavItem
          key={link.href}
          link={link}
          isActive={location.pathname === link.href || location.pathname.startsWith(link.href + '/')}
        />
      ))}
    </nav>
  );
};

// Mobile Navigation Props
interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  links: NavLink[];
  user?: User | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

// Animation variants for mobile menu
const menuVariants: Variants = {
  closed: {
    opacity: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
      when: 'afterChildren',
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
  open: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
      when: 'beforeChildren',
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  closed: {
    opacity: 0,
    x: -40,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const overlayVariants: Variants = {
  closed: {
    clipPath: 'circle(0% at calc(100% - 40px) 40px)',
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  open: {
    clipPath: 'circle(150% at calc(100% - 40px) 40px)',
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// Mobile Navigation Overlay
export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  links,
  user,
  onSignIn,
  onSignOut,
}) => {
  const location = useLocation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 lg:hidden"
          initial="closed"
          animate="open"
          exit="closed"
          variants={menuVariants}
        >
          {/* Background overlay */}
          <motion.div
            className="absolute inset-0 bg-bzr-black"
            variants={overlayVariants}
          />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col px-6 pt-24 pb-8">
            {/* Navigation Links */}
            <nav className="flex-1 flex flex-col justify-center">
              {links.map((link, index) => {
                const isActive = location.pathname === link.href;

                return (
                  <motion.div
                    key={link.href}
                    variants={itemVariants}
                    custom={index}
                  >
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className="group block py-4"
                      >
                        <span className={cn(
                          'text-4xl md:text-5xl font-display font-bold transition-colors',
                          isActive ? 'text-bzr-white' : 'text-bzr-gray-500 group-hover:text-bzr-white'
                        )}>
                          {link.label}
                        </span>
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        onClick={onClose}
                        className="group block py-4"
                      >
                        <span className="flex items-center gap-4">
                          <span className={cn(
                            'text-4xl md:text-5xl font-display font-bold transition-colors',
                            isActive ? 'text-bzr-white' : 'text-bzr-gray-500 group-hover:text-bzr-white'
                          )}>
                            {link.label}
                          </span>
                          {isActive && (
                            <motion.span
                              layoutId="mobile-nav-indicator"
                              className="w-2 h-2 rounded-full bg-bzr-blue"
                            />
                          )}
                        </span>
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </nav>

            {/* Bottom Section */}
            <motion.div
              variants={itemVariants}
              className="pt-8 border-t border-bzr-gray-800"
            >
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-bzr-blue flex items-center justify-center">
                        <span className="text-lg font-medium text-white">
                          {(user.displayName || user.email || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-medium text-bzr-white">
                        {user.displayName || 'User'}
                      </p>
                      <p className="text-sm text-bzr-gray-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      to="/profile"
                      onClick={onClose}
                      className="flex-1 px-4 py-3 text-center text-sm font-medium text-bzr-white bg-bzr-gray-800 rounded-xl hover:bg-bzr-gray-700 transition-colors"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        onSignOut?.();
                        onClose();
                      }}
                      className="flex-1 px-4 py-3 text-center text-sm font-medium text-red-400 bg-bzr-gray-800 rounded-xl hover:bg-bzr-gray-700 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onSignIn?.();
                    onClose();
                  }}
                  className="w-full px-6 py-4 text-lg font-medium text-bzr-black bg-bzr-white rounded-xl hover:bg-bzr-gray-100 transition-colors"
                >
                  Sign In
                </button>
              )}
            </motion.div>

            {/* Social Links / Extra */}
            <motion.div
              variants={itemVariants}
              className="pt-6 flex items-center justify-center gap-6"
            >
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bzr-gray-500 hover:text-bzr-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bzr-gray-500 hover:text-bzr-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bzr-gray-500 hover:text-bzr-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
              </a>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export type { NavigationProps, MobileNavigationProps };
