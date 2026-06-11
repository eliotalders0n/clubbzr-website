'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CommunityPost as CommunityPostType, ReactionType, Comment } from '../../../../lib/schema';
import { Timestamp } from 'firebase/firestore';
import { ReactionBar } from './ReactionBar';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface CommunityPostProps {
  post: CommunityPostType;
  comments?: Comment[];
  commentsLoading?: boolean;
  commentsHasMore?: boolean;
  currentUserId?: string;
  onReaction?: (reactionType: ReactionType) => void;
  onComment?: (content: string) => void | Promise<void>;
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
    <CommentAvatar name={comment.userName} photoURL={comment.userPhotoURL} />

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
        <span
          style={{
            display: 'block',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.25,
            marginBottom: '6px',
          }}
        >
          {comment.userName}
        </span>
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
        className="p-2 rounded-full hover:bg-bzr-gray-800 text-bzr-gray-500 hover:text-bzr-white transition-colors"
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
              className="absolute right-0 top-full mt-1 z-20 w-48 bg-bzr-gray-800 rounded-xl border border-bzr-gray-700 overflow-hidden shadow-xl py-2"
            >
              {onShare && (
                <button
                  onClick={() => {
                    onShare();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-bzr-white hover:bg-bzr-gray-700 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Share Post
                </button>
              )}

              {isOwner && onEdit && (
                <button
                  onClick={() => {
                    onEdit();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-bzr-white hover:bg-bzr-gray-700 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Post
                </button>
              )}

              {isOwner && onDelete && (
                <button
                  onClick={() => {
                    onDelete();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Post
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
  onCommentsOpen,
  onLoadMoreComments,
  onEdit,
  onDelete,
  onShare,
  className,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isOwner = post.userId === currentUserId;
  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
  const displayCommentsCount = Math.max(post.commentsCount || 0, comments.length);

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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Avatar */}
            <CommentAvatar name={post.userName} photoURL={post.userPhotoURL} size={44} />

            {/* User info */}
            <div>
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
            </div>
          </div>

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
        <div className="relative">
          {post.mediaUrls.length === 1 ? (
            <div className="relative aspect-video">
              {!imageLoaded && (
                <div className="absolute inset-0 bg-bzr-gray-800 animate-pulse" />
              )}
              {post.mediaType === 'video' ? (
                <video
                  src={post.mediaUrls[0]}
                  className="w-full h-full object-cover"
                  controls
                  onLoadedData={() => setImageLoaded(true)}
                />
              ) : (
                <img
                  src={post.mediaUrls[0]}
                  alt=""
                  className={cn(
                    'w-full h-full object-cover transition-opacity',
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                  onLoad={() => setImageLoaded(true)}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0.5">
              {post.mediaUrls.slice(0, 4).map((url, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {index === 3 && post.mediaUrls.length > 4 && (
                    <div className="absolute inset-0 bg-bzr-black/60 flex items-center justify-center">
                      <span className="text-2xl font-bold text-bzr-white">
                        +{post.mediaUrls.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reactions */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #262626' }}>
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
              {onComment && (
                <div style={{ marginBottom: comments.length > 0 || commentsLoading ? '18px' : 0 }}>
                  <CommentInput onSubmit={onComment} />
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
