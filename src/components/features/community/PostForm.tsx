'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MediaType, CreateDocument, CommunityPost } from '../../../../lib/schema';
import { uploadMultiple, STORAGE_PATHS } from '../../../../lib/storage';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface FilePreview {
  file: File;
  url: string;
  type: MediaType;
}

interface PostFormProps {
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  initialPrompt?: string;
  onSubmit: (data: CreateDocument<CommunityPost>) => Promise<void>;
  onPromptClear?: () => void;
  className?: string;
}

// Get media type from file
const getMediaType = (file: File): MediaType => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
};

// Media preview component
const MediaPreview: React.FC<{
  previews: FilePreview[];
  onRemove: (index: number) => void;
}> = ({ previews, onRemove }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {previews.map((preview, index) => (
      <motion.div
        key={preview.url}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative aspect-square rounded-lg overflow-hidden group"
      >
        {preview.type === 'image' && (
          <img
            src={preview.url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        {preview.type === 'video' && (
          <video
            src={preview.url}
            className="w-full h-full object-cover"
            muted
          />
        )}
        {preview.type === 'audio' && (
          <div className="w-full h-full flex items-center justify-center bg-bzr-gray-800">
            <svg className="w-12 h-12 text-bzr-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Remove button */}
        <motion.button
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-bzr-black/60 text-bzr-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </motion.div>
    ))}
  </div>
);

// Success animation
const SuccessAnimation: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-bzr-gray-900/95 rounded-2xl z-10"
    >
      <motion.div
        className="w-16 h-16 rounded-full bg-bzr-green/20 flex items-center justify-center mb-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <motion.svg
          className="w-8 h-8 text-bzr-green"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </motion.svg>
      </motion.div>
      <p className="font-display text-bzr-white">Posted!</p>
    </motion.div>
  );
};

export const PostForm: React.FC<PostFormProps> = ({
  userId,
  userName,
  userPhotoURL,
  initialPrompt,
  onSubmit,
  onPromptClear,
  className,
}) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedPrompt = initialPrompt && initialPrompt.trim().length > 0 ? initialPrompt : null;

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(80, textarea.scrollHeight)}px`;
    }
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    const newPreviews: FilePreview[] = selectedFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: getMediaType(file),
    }));

    setFiles((prev) => [...prev, ...newPreviews].slice(0, 4)); // Max 4 files
  }, []);

  // Remove file
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // Validate form
  const isValid = content.trim().length > 0 || files.length > 0;

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Upload files to Firebase Storage if any
      let mediaUrls: string[] = [];
      if (files.length > 0) {
        const filesToUpload = files.map((f) => f.file);
        const uploadResult = await uploadMultiple(
          filesToUpload,
          STORAGE_PATHS.COMMUNITY,
          {
            compress: true,
            compressionOptions: {
              maxWidth: 1920,
              maxHeight: 1080,
              quality: 0.85,
            },
          }
        );

        if (!uploadResult.success) {
          console.error('Failed to upload media:', uploadResult.error);
          throw new Error(uploadResult.error?.message || 'Failed to upload media');
        }

        mediaUrls = uploadResult.urls;
      }

      const postData: CreateDocument<CommunityPost> = {
        userId,
        userName,
        ...(userPhotoURL ? { userPhotoURL } : {}),
        ...(selectedPrompt ? { prompt: selectedPrompt } : {}),
        content: content.trim(),
        mediaUrls,
        mediaType: files.length > 0 ? files[0].type : null,
        reactions: {},
        reactionsCount: 0,
        comments: [],
        commentsCount: 0,
        shares: 0,
        featured: false,
        pinned: false,
        tags: [],
        isApproved: true,
        isHidden: false,
      };

      await onSubmit(postData);

      // Show success animation
      setShowSuccess(true);

      // Clean up blob URLs
      files.forEach((f) => URL.revokeObjectURL(f.url));

      // Reset form after animation
      setTimeout(() => {
        setContent('');
        setFiles([]);
        setShowSuccess(false);
        setIsFocused(false);
        onPromptClear?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className={cn(
        'relative bg-bzr-gray-900 rounded-2xl border border-bzr-gray-800 overflow-hidden',
        className
      )}
      animate={{
        borderColor: isFocused || selectedPrompt ? 'rgba(0, 102, 255, 0.5)' : 'rgba(38, 38, 38, 1)',
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && <SuccessAnimation />}
      </AnimatePresence>

      <div style={{ padding: '20px', paddingBottom: '16px' }}>
        {/* User info and text input */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Avatar */}
          {userPhotoURL ? (
            <img
              src={userPhotoURL}
              alt={userName}
              style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '16px', fontWeight: 500, color: '#9CA3AF' }}>{userName.charAt(0)}</span>
            </div>
          )}

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              adjustTextareaHeight();
            }}
            onFocus={() => setIsFocused(true)}
            placeholder="Share something with the community..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: '#fff',
              resize: 'none',
              outline: 'none',
              minHeight: '100px',
              fontSize: '16px',
              lineHeight: 1.6,
              paddingTop: '8px',
              border: 'none',
            }}
            disabled={isSubmitting}
          />
        </div>

        {/* Show selected prompt if any */}
        {selectedPrompt && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Responding to:
            </span>
            <span style={{
              fontSize: '13px',
              color: '#9CA3AF',
              backgroundColor: '#1f2937',
              padding: '4px 10px',
              borderRadius: '6px',
            }}>
              {selectedPrompt}
            </span>
            {onPromptClear && (
              <button
                type="button"
                onClick={onPromptClear}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Media previews */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <MediaPreview previews={files} onRemove={removeFile} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderTop: '1px solid #262626',
        backgroundColor: 'rgba(17, 17, 17, 0.5)',
      }}>
        {/* Media buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={isSubmitting || files.length >= 4}
          />

          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || files.length >= 4}
            style={{
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: files.length >= 4 ? 'not-allowed' : 'pointer',
              color: files.length >= 4 ? '#4B5563' : '#9CA3AF',
              transition: 'all 0.2s',
            }}
            whileHover={files.length < 4 ? { scale: 1.05, backgroundColor: '#1f2937' } : {}}
            whileTap={files.length < 4 ? { scale: 0.95 } : {}}
          >
            <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </motion.button>

          {files.length > 0 && (
            <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: 'monospace' }}>
              {files.length}/4
            </span>
          )}
        </div>

        {/* Submit button */}
        <motion.button
          type="submit"
          disabled={!isValid || isSubmitting}
          style={{
            padding: '12px 28px',
            borderRadius: '12px',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: !isValid || isSubmitting ? 'not-allowed' : 'pointer',
            backgroundColor: isValid ? '#FF6B35' : '#374151',
            color: isValid ? '#fff' : '#6B7280',
            transition: 'all 0.2s',
          }}
          whileHover={isValid ? { scale: 1.02 } : {}}
          whileTap={isValid ? { scale: 0.98 } : {}}
        >
          {isSubmitting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <motion.span
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Posting...
            </span>
          ) : (
            'Post'
          )}
        </motion.button>
      </div>
    </motion.form>
  );
};

export type { PostFormProps };
