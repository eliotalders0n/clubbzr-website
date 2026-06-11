'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Quest, MediaType, CreateDocument, QuestSubmission } from '../../../../lib/schema';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

interface FilePreview {
  file: File;
  url: string;
  type: MediaType;
}

interface QuestSubmissionFormProps {
  quest: Quest;
  onSubmit: (data: CreateDocument<QuestSubmission>) => Promise<void>;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  className?: string;
}

// Media type detector
const getMediaType = (file: File): MediaType => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
};

// File size formatter
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Progress indicator component
const ProgressIndicator: React.FC<{ progress: number; label: string }> = ({
  progress,
  label,
}) => (
  <div className="w-full">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm text-bzr-gray-400">{label}</span>
      <span className="text-sm font-mono text-bzr-green">{progress}%</span>
    </div>
    <div className="h-1 bg-bzr-gray-800 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-bzr-green"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  </div>
);

// Success animation component
const SuccessAnimation: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center py-12"
  >
    <motion.div
      className="w-20 h-20 rounded-full bg-bzr-green/20 flex items-center justify-center mb-6"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
    >
      <motion.svg
        className="w-10 h-10 text-bzr-green"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <motion.path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M5 13l4 4L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
      </motion.svg>
    </motion.div>

    <motion.h3
      className="font-display text-2xl text-bzr-white mb-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      Quest Submitted!
    </motion.h3>

    <motion.p
      className="text-bzr-gray-400 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      Your creative work has been added to the quest.
    </motion.p>

    {/* Confetti-like particles */}
    {Array.from({ length: 20 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full"
        style={{
          backgroundColor: ['#CCFF00', '#0066FF', '#FF6B35', '#E6E6FA'][i % 4],
          top: '50%',
          left: '50%',
        }}
        initial={{ scale: 0 }}
        animate={{
          scale: [0, 1, 0],
          x: Math.cos((i * Math.PI * 2) / 20) * 100,
          y: Math.sin((i * Math.PI * 2) / 20) * 100,
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 1,
          delay: 0.3 + i * 0.02,
          ease: 'easeOut',
        }}
      />
    ))}
  </motion.div>
);

// File preview component
const FilePreviewCard: React.FC<{
  preview: FilePreview;
  onRemove: () => void;
}> = ({ preview, onRemove }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="relative group rounded-lg overflow-hidden bg-bzr-gray-800"
  >
    {preview.type === 'image' && (
      <img
        src={preview.url}
        alt="Preview"
        className="w-full h-32 object-cover"
      />
    )}
    {preview.type === 'video' && (
      <video
        src={preview.url}
        className="w-full h-32 object-cover"
        muted
      />
    )}
    {preview.type === 'audio' && (
      <div className="w-full h-32 flex items-center justify-center bg-bzr-gray-800">
        <svg className="w-12 h-12 text-bzr-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
    )}
    {preview.type === 'document' && (
      <div className="w-full h-32 flex items-center justify-center bg-bzr-gray-800">
        <svg className="w-12 h-12 text-bzr-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    )}

    {/* File info overlay */}
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bzr-black/80 to-transparent p-2">
      <p className="text-xs text-bzr-white truncate">{preview.file.name}</p>
      <p className="text-[10px] text-bzr-gray-400">{formatFileSize(preview.file.size)}</p>
    </div>

    {/* Remove button */}
    <motion.button
      onClick={onRemove}
      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-bzr-black/60 text-bzr-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </motion.button>
  </motion.div>
);

export const QuestSubmissionForm: React.FC<QuestSubmissionFormProps> = ({
  quest,
  onSubmit,
  userId,
  userName,
  userPhotoURL,
  className,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    const newPreviews: FilePreview[] = selectedFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: getMediaType(file),
    }));

    setFiles((prev) => [...prev, ...newPreviews]);
    setError(null);
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

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);

    const newPreviews: FilePreview[] = droppedFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: getMediaType(file),
    }));

    setFiles((prev) => [...prev, ...newPreviews]);
    setError(null);
  }, []);

  // Validate form
  const isValid = content.trim().length > 0 && files.length > 0;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setError('Please add content and at least one media file.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // In a real implementation, you would upload files to storage here
      // and get back URLs. For now, we'll use placeholder URLs.
      const mediaUrls = files.map((f) => f.url);

      const submissionData: CreateDocument<QuestSubmission> = {
        questId: quest.id,
        userId,
        userName,
        userPhotoURL,
        title: title.trim() || undefined,
        content: content.trim(),
        mediaUrls,
        mediaType: files[0]?.type || 'image',
        thumbnailUrl: files[0]?.url,
        reactions: {},
        reactionsCount: 0,
        commentsCount: 0,
        upvotes: [],
        downvotes: [],
        upvotesCount: 0,
        downvotesCount: 0,
        voteScore: 0,
        featured: false,
        approved: true,
        showOnWall: true,
        pointsAwarded: quest.points,
        questTitle: quest.title,
      };

      await onSubmit(submissionData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Show success state
      setTimeout(() => {
        setIsSuccess(true);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className={cn('relative bg-bzr-gray-900 rounded-2xl p-6 border border-bzr-gray-800', className)}>
        <SuccessAnimation />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'bg-bzr-gray-900 rounded-2xl p-6 border border-bzr-gray-800',
        className
      )}
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="font-display text-xl text-bzr-white mb-1">
          Submit Your Work
        </h3>
        <p className="text-sm text-bzr-gray-400">
          Share your creative response to &quot;{quest.title}&quot;
        </p>
      </div>

      {/* Title field (optional) */}
      <div className="mb-4">
        <label className="block text-sm text-bzr-gray-400 mb-2">
          Title <span className="text-bzr-gray-600">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your work a title..."
          className="w-full px-4 py-3 bg-bzr-gray-800 border border-bzr-gray-700 rounded-lg text-bzr-white placeholder-bzr-gray-500 focus:outline-none focus:border-bzr-blue transition-colors"
          disabled={isSubmitting}
        />
      </div>

      {/* Content field */}
      <div className="mb-4">
        <label className="block text-sm text-bzr-gray-400 mb-2">
          Description / Artist Statement
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Tell us about your creative process, inspiration, or anything you'd like to share..."
          rows={4}
          className="w-full px-4 py-3 bg-bzr-gray-800 border border-bzr-gray-700 rounded-lg text-bzr-white placeholder-bzr-gray-500 focus:outline-none focus:border-bzr-blue transition-colors resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* File upload area */}
      <div className="mb-6">
        <label className="block text-sm text-bzr-gray-400 mb-2">
          Media Upload
        </label>
        <motion.div
          className={cn(
            'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
            'border-bzr-gray-700 hover:border-bzr-gray-600',
            files.length === 0 && 'min-h-[160px] flex items-center justify-center'
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          whileHover={{ borderColor: 'rgba(204, 255, 0, 0.3)' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isSubmitting}
          />

          {files.length === 0 ? (
            <div>
              <svg
                className="w-12 h-12 mx-auto mb-3 text-bzr-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-bzr-gray-400 mb-2">
                Drag & drop your files here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-bzr-blue hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-bzr-gray-500">
                Supports images, videos, and audio files
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AnimatePresence>
                {files.map((preview, index) => (
                  <FilePreviewCard
                    key={preview.url}
                    preview={preview}
                    onRemove={() => removeFile(index)}
                  />
                ))}
              </AnimatePresence>

              {/* Add more button */}
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-32 rounded-lg border-2 border-dashed border-bzr-gray-700 flex flex-col items-center justify-center text-bzr-gray-500 hover:border-bzr-gray-600 hover:text-bzr-gray-400 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">Add more</span>
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <ProgressIndicator progress={uploadProgress} label="Uploading..." />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <motion.button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-6 py-3 bg-bzr-gray-800 text-bzr-white rounded-lg font-display text-sm hover:bg-bzr-gray-700 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isSubmitting || !isValid}
        >
          Preview
        </motion.button>

        <motion.button
          type="submit"
          className={cn(
            'flex-1 px-6 py-3 rounded-lg font-display text-sm transition-all',
            isValid
              ? 'bg-bzr-green text-bzr-black hover:shadow-glow-green'
              : 'bg-bzr-gray-700 text-bzr-gray-500 cursor-not-allowed'
          )}
          whileHover={isValid ? { scale: 1.02 } : {}}
          whileTap={isValid ? { scale: 0.98 } : {}}
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="w-4 h-4 border-2 border-bzr-black/30 border-t-bzr-black rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Submitting...
            </span>
          ) : (
            `Submit (+${quest.points} pts)`
          )}
        </motion.button>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bzr-black/80 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-bzr-gray-900 rounded-2xl p-6 border border-bzr-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-xl text-bzr-white mb-4">Preview</h3>

              {/* Preview content */}
              <div className="mb-4">
                {title && (
                  <h4 className="font-display text-lg text-bzr-white mb-2">{title}</h4>
                )}
                <p className="text-bzr-gray-300 whitespace-pre-wrap">{content}</p>
              </div>

              {/* Preview media */}
              {files.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {files.slice(0, 4).map((preview, index) => (
                    <div key={preview.url} className="relative rounded-lg overflow-hidden">
                      {preview.type === 'image' && (
                        <img src={preview.url} alt="" className="w-full h-40 object-cover" />
                      )}
                      {preview.type === 'video' && (
                        <video src={preview.url} className="w-full h-40 object-cover" controls />
                      )}
                      {preview.type === 'audio' && (
                        <div className="w-full h-40 flex items-center justify-center bg-bzr-gray-800">
                          <audio src={preview.url} controls className="w-full px-4" />
                        </div>
                      )}
                      {index === 3 && files.length > 4 && (
                        <div className="absolute inset-0 bg-bzr-black/60 flex items-center justify-center">
                          <span className="text-xl font-bold text-bzr-white">
                            +{files.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="w-full px-6 py-3 bg-bzr-gray-800 text-bzr-white rounded-lg font-display text-sm hover:bg-bzr-gray-700 transition-colors"
              >
                Close Preview
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
};

export type { QuestSubmissionFormProps };
