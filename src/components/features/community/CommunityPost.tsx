'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronLeft, ChevronRight, Expand, LogIn, MapPin, X } from 'lucide-react';
import type { CommunityPost as CommunityPostType, ReactionType, Comment } from '../../../../lib/schema';
import { Timestamp } from 'firebase/firestore';
import { ReactionBar } from './ReactionBar';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));
const getMemberHref = (userId: string) => `/members/${userId}`;
const isVideoMedia = (mediaType: CommunityPostType['mediaType']): boolean => mediaType === 'video';
const mobileMediaFrameClass = 'aspect-[9/16] sm:aspect-[9/14] md:aspect-[4/5]';

interface CommunityPostProps {
  post: CommunityPostType;
  comments?: Comment[];
  commentsLoading?: boolean;
  commentsHasMore?: boolean;
  currentUserId?: string;
  onReaction?: (reactionType: ReactionType) => void;
  onComment?: (content: string) => void | Promise<void>;
  onAuthRequired?: () => void;
  onCommentsOpen?: () => void | Promise<void>;
  onLoadMoreComments?: () => void | Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  className?: string;
}

// Format timestamp helper
const formatTimestamp = (timestamp: unknown): string => {
  const date = timestamp instanceof Timestamp
    ? timestamp.toDate()
    : timestamp instanceof Date
      ? timestamp
      : null;

  if (!date) return 'Just now';

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Format date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

// Comment input component
const CommentInput: React.FC<{
  onSubmit: (content: string) => void | Promise<void>;
  placeholder?: string;
}> = ({ onSubmit, placeholder = 'Write a comment...' }) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();

    if (!trimmedContent || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit(trimmedContent);
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          height: '48px',
          padding: '0 18px',
          backgroundColor: '#1f2937',
          borderRadius: '24px',
          color: '#fff',
          fontSize: '14px',
          border: isFocused ? '1px solid #3B82F6' : '1px solid transparent',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
      />
      <motion.button
        type="submit"
        disabled={!content.trim() || isSubmitting}
        style={{
          flexShrink: 0,
          height: '48px',
          minWidth: '84px',
          padding: '0 20px',
          borderRadius: '24px',
          fontSize: '14px',
          fontWeight: 500,
          border: 'none',
          cursor: content.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
          backgroundColor: content.trim() && !isSubmitting ? '#3B82F6' : '#374151',
          color: content.trim() && !isSubmitting ? '#fff' : '#6B7280',
          transition: 'all 0.2s',
        }}
        whileHover={content.trim() && !isSubmitting ? { scale: 1.02 } : {}}
        whileTap={content.trim() && !isSubmitting ? { scale: 0.98 } : {}}
      >
        {isSubmitting ? 'Posting' : 'Post'}
      </motion.button>
    </form>
  );
};

const CommentAvatar: React.FC<{
  name: string;
  photoURL?: string;
  size?: number;
}> = ({ name, photoURL, size = 36 }) => {
  const avatarStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    maxWidth: `${size}px`,
    minHeight: `${size}px`,
    maxHeight: `${size}px`,
    flex: `0 0 ${size}px`,
    borderRadius: '9999px',
    overflow: 'hidden',
  };

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        style={{
          ...avatarStyle,
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...avatarStyle,
        backgroundColor: '#374151',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: size >= 40 ? '15px' : '13px', fontWeight: 600, color: '#D1D5DB' }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

const MediaPreview: React.FC<{
  url: string;
  mediaType: CommunityPostType['mediaType'];
  className?: string;
  controls?: boolean;
  onLoad?: () => void;
}> = ({ url, mediaType, className, controls = false, onLoad }) => {
  if (isVideoMedia(mediaType)) {
    return (
      <video
        src={url}
        className={cn('h-full w-full object-cover', className)}
        controls={controls}
        onLoadedData={onLoad}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={cn('h-full w-full object-cover', className)}
      onLoad={onLoad}
    />
  );
};

const MediaCountBadge: React.FC<{
  currentIndex: number;
  total: number;
}> = ({ currentIndex, total }) => (
  <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
    <span>{currentIndex + 1}</span>
    <span className="h-1 w-1 rounded-full bg-white/45" />
    <span>{total}</span>
  </div>
);

const MediaDots: React.FC<{
  currentIndex: number;
  total: number;
}> = ({ currentIndex, total }) => (
  <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-2 backdrop-blur-md">
    {Array.from({ length: total }).map((_, index) => (
      <span
        key={index}
        className={cn(
          'block h-1.5 rounded-full transition-all',
          index === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
        )}
      />
    ))}
  </div>
);

const MediaNavButton: React.FC<{
  direction: 'previous' | 'next';
  onClick: () => void;
  className?: string;
}> = ({ direction, onClick, className }) => {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={direction === 'previous' ? 'Previous image' : 'Next image'}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75',
        className
      )}
    >
      <Icon size={20} strokeWidth={2.4} />
    </button>
  );
};

const FullscreenMediaViewer: React.FC<{
  mediaUrls: string[];
  mediaType: CommunityPostType['mediaType'];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}> = ({ mediaUrls, mediaType, currentIndex, onClose, onNavigate }) => {
  const currentUrl = mediaUrls[currentIndex];
  const hasMultipleMedia = mediaUrls.length > 1;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft' && hasMultipleMedia) {
        onNavigate((currentIndex - 1 + mediaUrls.length) % mediaUrls.length);
      }
      if (event.key === 'ArrowRight' && hasMultipleMedia) {
        onNavigate((currentIndex + 1) % mediaUrls.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, hasMultipleMedia, mediaUrls.length, onClose, onNavigate]);

  if (!currentUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[120] flex flex-col bg-black/95"
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
          {currentIndex + 1} / {mediaUrls.length}
        </div>
        <button
          type="button"
          aria-label="Close fullscreen media"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-5 sm:px-8">
        {hasMultipleMedia && (
          <>
            <MediaNavButton
              direction="previous"
              onClick={() => onNavigate((currentIndex - 1 + mediaUrls.length) % mediaUrls.length)}
              className="left-3 sm:left-6"
            />
            <MediaNavButton
              direction="next"
              onClick={() => onNavigate((currentIndex + 1) % mediaUrls.length)}
              className="right-3 sm:right-6"
            />
          </>
        )}

        {isVideoMedia(mediaType) ? (
          <video
            src={currentUrl}
            className="max-h-full max-w-full rounded-lg object-contain"
            controls
            autoPlay
          />
        ) : (
          <img
            src={currentUrl}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}
      </div>
    </motion.div>
  );
};

// Single comment component
const CommentItem: React.FC<{
  comment: Comment;
}> = ({ comment }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      width: '100%',
    }}
  >
    <Link to={getMemberHref(comment.userId)} style={{ textDecoration: 'none' }}>
      <CommentAvatar name={comment.userName} photoURL={comment.userPhotoURL} />
    </Link>

    {/* Content */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          backgroundColor: 'rgba(31, 31, 31, 0.92)',
          borderRadius: '16px',
          padding: '12px 14px',
          border: '1px solid rgba(255, 255, 255, 0.03)',
        }}
      >
        <Link
          to={getMemberHref(comment.userId)}
          style={{
            display: 'block',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.25,
            marginBottom: '6px',
            textDecoration: 'none',
          }}
        >
          {comment.userName}
        </Link>
        <p
          style={{
            color: '#D1D5DB',
            fontSize: '14px',
            lineHeight: 1.45,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {comment.content}
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '6px',
          paddingLeft: '4px',
        }}
      >
        <span style={{ color: '#737373', fontSize: '12px', lineHeight: 1 }}>
          {formatTimestamp(comment.createdAt)}
        </span>
        {comment.isEdited && (
          <span style={{ color: '#525252', fontSize: '12px', lineHeight: 1 }}>Edited</span>
        )}
      </div>
    </div>
  </motion.div>
);

// Post menu dropdown
const PostMenu: React.FC<{
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
}> = ({ isOwner, onEdit, onDelete, onShare }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-bzr-gray-500 transition-colors hover:bg-bzr-gray-800 hover:text-bzr-white"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-bzr-gray-700/80 bg-bzr-gray-800/95 py-1.5 pl-3 pr-1.5 shadow-xl backdrop-blur-md"
            >
              {onShare && (
                <button
                  onClick={() => {
                    onShare();
                    setIsOpen(false);
                  }}
                  className="flex min-h-10 w-full items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-left text-sm font-medium leading-none text-bzr-gray-200 transition-colors hover:bg-white/5 hover:text-bzr-white"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-bzr-gray-400">
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </span>
                  <span>Share Post</span>
                </button>
              )}

              {isOwner && onEdit && (
                <button
                  onClick={() => {
                    onEdit();
                    setIsOpen(false);
                  }}
                  className="flex min-h-10 w-full items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-left text-sm font-medium leading-none text-bzr-gray-200 transition-colors hover:bg-white/5 hover:text-bzr-white"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-200/80">
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </span>
                  <span>Edit Post</span>
                </button>
              )}

              {isOwner && onDelete && (
                <button
                  onClick={() => {
                    onDelete();
                    setIsOpen(false);
                  }}
                  className="flex min-h-10 w-full items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-left text-sm font-medium leading-none text-red-300/90 transition-colors hover:bg-red-500/10"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-300/80">
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </span>
                  <span>Delete Post</span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CommunityPost: React.FC<CommunityPostProps> = ({
  post,
  comments = [],
  commentsLoading = false,
  commentsHasMore = false,
  currentUserId,
  onReaction,
  onComment,
  onAuthRequired,
  onCommentsOpen,
  onLoadMoreComments,
  onEdit,
  onDelete,
  onShare,
  className,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeDeltaRef = useRef({ x: 0, y: 0 });

  const isOwner = post.userId === currentUserId;
  const mediaUrls = post.mediaUrls || [];
  const hasMedia = mediaUrls.length > 0;
  const displayCommentsCount = Math.max(post.commentsCount || 0, comments.length);
  const safeActiveMediaIndex = mediaUrls.length === 0
    ? 0
    : Math.min(activeMediaIndex, mediaUrls.length - 1);

  const navigateMedia = (direction: 'previous' | 'next') => {
    setActiveMediaIndex((currentIndex) => {
      if (mediaUrls.length === 0) return 0;
      return direction === 'previous'
        ? (currentIndex - 1 + mediaUrls.length) % mediaUrls.length
        : (currentIndex + 1) % mediaUrls.length;
    });
  };

  const handleMobileCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mediaUrls.length < 2) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    swipeDeltaRef.current = { x: 0, y: 0 };
  };

  const handleMobileCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    swipeDeltaRef.current = {
      x: event.clientX - swipeStartRef.current.x,
      y: event.clientY - swipeStartRef.current.y,
    };
  };

  const finishMobileCarouselPointer = () => {
    if (!swipeStartRef.current) return false;
    const { x, y } = swipeDeltaRef.current;
    const isHorizontalSwipe = Math.abs(x) > 42 && Math.abs(x) > Math.abs(y) * 1.25;
    swipeStartRef.current = null;
    swipeDeltaRef.current = { x: 0, y: 0 };

    if (!isHorizontalSwipe) return false;
    navigateMedia(x < 0 ? 'next' : 'previous');
    return true;
  };

  const handleCommentsToggle = () => {
    const nextShowComments = !showComments;
    setShowComments(nextShowComments);

    if (nextShowComments) {
      void onCommentsOpen?.();
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        backgroundColor: 'rgb(17, 17, 17)',
        borderRadius: '16px',
        border: '1px solid rgba(38, 38, 38, 1)',
        overflow: 'hidden',
      }}
      className={className}
    >
      {/* Header */}
      <div style={{ padding: '20px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Link
            to={getMemberHref(post.userId)}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              minWidth: 0,
              textDecoration: 'none',
            }}
          >
            {/* Avatar */}
            <CommentAvatar name={post.userName} photoURL={post.userPhotoURL} size={44} />

            {/* User info */}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ color: '#fff', fontWeight: 500, fontSize: '15px', marginBottom: '2px' }}>
                {post.userName}
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7280' }}>
                {formatTimestamp(post.createdAt)}
                {post.prompt && (
                  <span style={{ marginLeft: '8px' }}>
                    responding to <span style={{ color: '#A78BFA' }}>{post.prompt}</span>
                  </span>
                )}
              </p>
              {post.location?.coordinates && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${post.location.coordinates.latitude},${post.location.coordinates.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '5px', color: '#FF8A5F', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}
                >
                  <MapPin size={13} />
                  {post.location.name || 'View post location'}
                </a>
              )}
            </div>
          </Link>

          {/* Menu */}
          <PostMenu
            isOwner={isOwner}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px 16px 20px' }}>
        <p style={{ color: '#E5E7EB', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '15px', lineHeight: 1.6 }}>
          {post.content}
        </p>
      </div>

      {/* Media */}
      {hasMedia && (
        <div className="relative z-0 overflow-hidden bg-black">
          {mediaUrls.length === 1 ? (
            <div className={cn('relative', mobileMediaFrameClass)}>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-bzr-gray-800 animate-pulse" />
              )}
              {isVideoMedia(post.mediaType) ? (
                <>
                  <MediaPreview
                    url={mediaUrls[0]}
                    mediaType={post.mediaType}
                    controls
                    onLoad={() => setImageLoaded(true)}
                  />
                  <button
                    type="button"
                    aria-label="Open media fullscreen"
                    onClick={() => setLightboxIndex(0)}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
                  >
                    <Expand size={17} strokeWidth={2.3} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="Open image fullscreen"
                  onClick={() => setLightboxIndex(0)}
                  className="group block h-full w-full cursor-zoom-in bg-bzr-gray-900"
                >
                  <MediaPreview
                    url={mediaUrls[0]}
                    mediaType={post.mediaType}
                    className={cn('transition-opacity', imageLoaded ? 'opacity-100' : 'opacity-0')}
                    onLoad={() => setImageLoaded(true)}
                  />
                  <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                    <Expand size={17} strokeWidth={2.3} />
                  </span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="block md:hidden">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open image ${safeActiveMediaIndex + 1} of ${mediaUrls.length} fullscreen`}
                  className={cn(
                    'relative cursor-zoom-in overflow-hidden bg-black select-none [touch-action:pan-y]',
                    mobileMediaFrameClass
                  )}
                  onPointerDown={handleMobileCarouselPointerDown}
                  onPointerMove={handleMobileCarouselPointerMove}
                  onPointerUp={(event) => {
                    if (event.target instanceof HTMLElement && event.target.closest('button')) {
                      swipeStartRef.current = null;
                      swipeDeltaRef.current = { x: 0, y: 0 };
                      return;
                    }
                    const didSwipe = finishMobileCarouselPointer();
                    if (!didSwipe && !isVideoMedia(post.mediaType)) {
                      setLightboxIndex(safeActiveMediaIndex);
                    }
                  }}
                  onPointerCancel={() => {
                    swipeStartRef.current = null;
                    swipeDeltaRef.current = { x: 0, y: 0 };
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setLightboxIndex(safeActiveMediaIndex);
                    }
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      navigateMedia('previous');
                    }
                    if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      navigateMedia('next');
                    }
                  }}
                >
                  <div
                    className="flex h-full transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${safeActiveMediaIndex * 100}%)` }}
                  >
                    {mediaUrls.map((url, index) => (
                      <div key={`${url}-${index}`} className="h-full w-full flex-none bg-black">
                        <MediaPreview
                          url={url}
                          mediaType={post.mediaType}
                          className="object-contain"
                          controls={isVideoMedia(post.mediaType) && index === safeActiveMediaIndex}
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    aria-label="Open media fullscreen"
                    onClick={(event) => {
                      event.stopPropagation();
                      setLightboxIndex(safeActiveMediaIndex);
                    }}
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
                  >
                    <Expand size={17} strokeWidth={2.3} />
                  </button>

                  <MediaNavButton
                    direction="previous"
                    onClick={() => navigateMedia('previous')}
                    className="left-3"
                  />
                  <MediaNavButton
                    direction="next"
                    onClick={() => navigateMedia('next')}
                    className="right-3"
                  />
                  <MediaCountBadge currentIndex={safeActiveMediaIndex} total={mediaUrls.length} />
                  <MediaDots currentIndex={safeActiveMediaIndex} total={mediaUrls.length} />
                </div>
              </div>

              <div className="hidden grid-cols-2 gap-0.5 md:grid">
                {mediaUrls.slice(0, 4).map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Open media ${index + 1} fullscreen`}
                    onClick={() => setLightboxIndex(index)}
                    className="group relative aspect-square cursor-zoom-in overflow-hidden bg-bzr-gray-900"
                  >
                    <MediaPreview url={url} mediaType={post.mediaType} />
                    <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                      <Expand size={16} strokeWidth={2.3} />
                    </span>
                    {index === 3 && mediaUrls.length > 4 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-bzr-black/60">
                        <span className="text-2xl font-bold text-bzr-white">
                          +{mediaUrls.length - 4}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {lightboxIndex !== null && (
          <FullscreenMediaViewer
            mediaUrls={mediaUrls}
            mediaType={post.mediaType}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </AnimatePresence>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          backgroundColor: 'rgb(17, 17, 17)',
          isolation: 'isolate',
        }}
      >
        {/* Reactions */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #262626', minHeight: '58px' }}>
          <ReactionBar
            reactions={post.reactions}
            currentUserId={currentUserId}
            onReaction={onReaction}
          />
        </div>

        {/* Actions bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '12px 20px',
          borderTop: '1px solid #262626',
        }}>
          {/* Comment toggle */}
          <button
            onClick={handleCommentsToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: showComments ? '#fff' : '#9CA3AF',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              {displayCommentsCount} {displayCommentsCount === 1 ? 'Comment' : 'Comments'}
            </span>
          </button>

          {/* Share button */}
          <button
            onClick={onShare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#9CA3AF',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Share</span>
          </button>
        </div>

        {/* Comments section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ borderTop: '1px solid #262626', overflow: 'hidden' }}
            >
              <div style={{ padding: '18px clamp(16px, 4vw, 24px) 20px' }}>
              {/* Comment input first */}
              {onComment ? (
                <div style={{ marginBottom: comments.length > 0 || commentsLoading ? '18px' : 0 }}>
                  <CommentInput onSubmit={onComment} />
                </div>
              ) : (
                <div
                  style={{
                    marginBottom: comments.length > 0 || commentsLoading ? '18px' : 0,
                    padding: '14px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(31, 41, 55, 0.72)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: '#D1D5DB', fontSize: '14px', lineHeight: 1.45 }}>
                    Sign in or create an account to comment on this post.
                  </span>
                  <motion.button
                    type="button"
                    onClick={onAuthRequired}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      minHeight: '38px',
                      padding: '0 16px',
                      borderRadius: '9999px',
                      backgroundColor: '#FF6B35',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LogIn size={15} strokeWidth={2} />
                    Sign in
                  </motion.button>
                </div>
              )}

              {/* Comments list */}
              {commentsLoading && comments.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: '#9CA3AF',
                    fontSize: '14px',
                    padding: '18px 0',
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '9999px',
                      border: '2px solid rgba(156, 163, 175, 0.25)',
                      borderTopColor: '#9CA3AF',
                      display: 'inline-block',
                    }}
                    className="animate-spin"
                  />
                  Loading comments
                </div>
              ) : comments.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    paddingRight: '2px',
                  }}
                >
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                    />
                  ))}
                  {(commentsHasMore || commentsLoading) && (
                    <button
                      type="button"
                      onClick={() => void onLoadMoreComments?.()}
                      disabled={commentsLoading}
                      style={{
                        alignSelf: 'center',
                        marginTop: '2px',
                        padding: '9px 16px',
                        borderRadius: '9999px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'transparent',
                        color: commentsLoading ? '#6B7280' : '#D1D5DB',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: commentsLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {commentsLoading ? 'Loading...' : 'Load more comments'}
                    </button>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', padding: '16px 0' }}>
                  No comments yet. Be the first to comment!
                </p>
              )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};

// Skeleton loader
export const CommunityPostSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'bg-bzr-gray-900/80 rounded-2xl border border-bzr-gray-800 overflow-hidden',
      className
    )}
  >
    {/* Header skeleton */}
    <div className="flex items-center gap-3 p-4">
      <div className="w-10 h-10 rounded-full bg-bzr-gray-800 animate-pulse" />
      <div>
        <div className="h-4 w-24 bg-bzr-gray-800 rounded animate-pulse mb-1" />
        <div className="h-3 w-16 bg-bzr-gray-800 rounded animate-pulse" />
      </div>
    </div>

    {/* Content skeleton */}
    <div className="px-4 pb-4 space-y-2">
      <div className="h-4 w-full bg-bzr-gray-800 rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-bzr-gray-800 rounded animate-pulse" />
    </div>

    {/* Media skeleton */}
    <div className="aspect-video bg-bzr-gray-800 animate-pulse" />

    {/* Actions skeleton */}
    <div className="flex gap-4 p-4">
      <div className="h-6 w-16 bg-bzr-gray-800 rounded animate-pulse" />
      <div className="h-6 w-16 bg-bzr-gray-800 rounded animate-pulse" />
    </div>
  </div>
);

export type { CommunityPostProps };
