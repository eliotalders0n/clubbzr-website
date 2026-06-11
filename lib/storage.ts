/**
 * Firebase Storage Operations
 * Club BZR - Experimental Art Community
 *
 * File upload, download, and management utilities
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL as firebaseGetDownloadURL,
  deleteObject,
  listAll,
  getMetadata,
  UploadTask,
  SettableMetadata,
} from 'firebase/storage';
import { nanoid } from 'nanoid';

import { storage, STORAGE_PATHS } from './config';

// =============================================================================
// TYPES
// =============================================================================

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
  state: 'running' | 'paused' | 'success' | 'error' | 'canceled';
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: StorageError;
}

export interface MultipleUploadResult {
  success: boolean;
  results: UploadResult[];
  urls: string[];
  error?: StorageError;
}

export interface StorageError {
  code: string;
  message: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  contentType: string | undefined;
  timeCreated: string;
  updated: string;
  fullPath: string;
  downloadUrl?: string;
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export type StoragePath = string;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Parse storage error */
const parseError = (error: unknown): StorageError => {
  const err = error as { code?: string; message?: string };
  return {
    code: err?.code || 'unknown',
    message: err?.message || 'An unexpected storage error occurred.',
  };
};

/** Generate unique filename */
const generateFileName = (originalName: string): string => {
  const extension = originalName.split('.').pop() || '';
  const uniqueId = nanoid(12);
  const timestamp = Date.now();
  return `${timestamp}-${uniqueId}.${extension}`;
};

/** Get content type from file extension */
const getContentType = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return contentTypes[extension] || 'application/octet-stream';
};

/** Validate file size */
const validateFileSize = (file: File, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/** Validate file type */
const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  const fileType = file.type.split('/')[0]; // Get 'image', 'video', etc.
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  return (
    allowedTypes.includes(file.type) ||
    allowedTypes.includes(fileType) ||
    allowedTypes.includes(`.${extension}`)
  );
};

// =============================================================================
// IMAGE COMPRESSION
// =============================================================================

/**
 * Compress image before upload
 */
export const compressImage = (
  file: File,
  options: ImageCompressionOptions = {}
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      format = 'jpeg',
    } = options;

    // Only process images
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        const mimeType = `image/${format}`;
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not compress image'));
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error('Could not load image'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Generate thumbnail
 */
export const generateThumbnail = async (
  file: File,
  maxSize: number = 200
): Promise<Blob> => {
  return compressImage(file, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    quality: 0.7,
    format: 'jpeg',
  });
};

// =============================================================================
// UPLOAD OPERATIONS
// =============================================================================

/**
 * Upload a single file with progress tracking
 */
export const uploadFile = (
  file: File,
  storagePath: StoragePath,
  options?: {
    customFileName?: string;
    metadata?: SettableMetadata;
    compress?: boolean;
    compressionOptions?: ImageCompressionOptions;
    onProgress?: (progress: UploadProgress) => void;
  }
): { uploadTask: UploadTask; promise: Promise<UploadResult> } => {
  const fileName = options?.customFileName || generateFileName(file.name);
  const fullPath = `${storagePath}/${fileName}`;
  const storageRef = ref(storage, fullPath);

  const metadata: SettableMetadata = {
    contentType: file.type || getContentType(file.name),
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
    ...options?.metadata,
  };

  // Resumable uploads must be started once. Compression is handled by
  // uploadFileSimple/uploadMultiple when progress tracking is not required.
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  const promise = (async (): Promise<UploadResult> => {
    try {
      // Track progress
      if (options?.onProgress) {
        uploadTask.on('state_changed', (snapshot) => {
          const progress: UploadProgress = {
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            state: snapshot.state as UploadProgress['state'],
          };
          options.onProgress!(progress);
        });
      }

      // Wait for upload to complete
      await uploadTask;

      // Get download URL
      const url = await firebaseGetDownloadURL(storageRef);

      return { success: true, url, path: fullPath };
    } catch (error) {
      return { success: false, error: parseError(error) };
    }
  })();

  return { uploadTask, promise };
};

/**
 * Upload a file without progress tracking (simpler API)
 */
export const uploadFileSimple = async (
  file: File,
  storagePath: StoragePath,
  options?: {
    customFileName?: string;
    compress?: boolean;
    compressionOptions?: ImageCompressionOptions;
  }
): Promise<UploadResult> => {
  try {
    const fileName = options?.customFileName || generateFileName(file.name);
    const fullPath = `${storagePath}/${fileName}`;
    const storageRef = ref(storage, fullPath);

    // Process file
    let fileToUpload: Blob = file;
    if (options?.compress && file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file, options.compressionOptions);
    }

    // Upload
    const metadata: SettableMetadata = {
      contentType: file.type || getContentType(file.name),
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    };

    await uploadBytes(storageRef, fileToUpload, metadata);
    const url = await firebaseGetDownloadURL(storageRef);

    return { success: true, url, path: fullPath };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Upload multiple files
 */
export const uploadMultiple = async (
  files: File[],
  storagePath: StoragePath,
  options?: {
    compress?: boolean;
    compressionOptions?: ImageCompressionOptions;
    onProgress?: (fileIndex: number, progress: UploadProgress) => void;
    onFileComplete?: (fileIndex: number, result: UploadResult) => void;
  }
): Promise<MultipleUploadResult> => {
  const results: UploadResult[] = [];
  const urls: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = options?.onProgress
        ? await uploadFile(file, storagePath, {
            onProgress: (progress) => options.onProgress?.(i, progress),
          }).promise
        : await uploadFileSimple(file, storagePath, {
            compress: options?.compress,
            compressionOptions: options?.compressionOptions,
          });
      results.push(result);

      if (result.success && result.url) {
        urls.push(result.url);
      }

      options?.onFileComplete?.(i, result);
    }

    const allSuccess = results.every((r) => r.success);

    return {
      success: allSuccess,
      results,
      urls,
    };
  } catch (error) {
    return {
      success: false,
      results,
      urls,
      error: parseError(error),
    };
  }
};

/**
 * Upload from data URL (for canvas exports, etc.)
 */
export const uploadDataUrl = async (
  dataUrl: string,
  storagePath: StoragePath,
  fileName: string
): Promise<UploadResult> => {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const fullPath = `${storagePath}/${fileName}`;
    const storageRef = ref(storage, fullPath);

    await uploadBytes(storageRef, blob);
    const url = await firebaseGetDownloadURL(storageRef);

    return { success: true, url, path: fullPath };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// =============================================================================
// DOWNLOAD OPERATIONS
// =============================================================================

/**
 * Get download URL for a file
 */
export const getDownloadURL = async (path: string): Promise<string | null> => {
  try {
    const storageRef = ref(storage, path);
    return await firebaseGetDownloadURL(storageRef);
  } catch {
    return null;
  }
};

/**
 * Get file metadata
 */
export const getFileMetadata = async (path: string): Promise<FileMetadata | null> => {
  try {
    const storageRef = ref(storage, path);
    const metadata = await getMetadata(storageRef);
    const downloadUrl = await firebaseGetDownloadURL(storageRef);

    return {
      name: metadata.name,
      size: metadata.size,
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      updated: metadata.updated,
      fullPath: metadata.fullPath,
      downloadUrl,
    };
  } catch {
    return null;
  }
};

// =============================================================================
// DELETE OPERATIONS
// =============================================================================

/**
 * Delete a single file
 */
export const deleteFile = async (path: string): Promise<UploadResult> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Delete multiple files
 */
export const deleteMultiple = async (paths: string[]): Promise<UploadResult> => {
  try {
    await Promise.all(paths.map((path) => deleteFile(path)));
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Delete all files in a folder
 */
export const deleteFolder = async (folderPath: string): Promise<UploadResult> => {
  try {
    const folderRef = ref(storage, folderPath);
    const listResult = await listAll(folderRef);

    // Delete all files
    await Promise.all(listResult.items.map((itemRef) => deleteObject(itemRef)));

    // Recursively delete subfolders
    await Promise.all(listResult.prefixes.map((prefixRef) => deleteFolder(prefixRef.fullPath)));

    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// =============================================================================
// LIST OPERATIONS
// =============================================================================

/**
 * List all files in a folder
 */
export const listFiles = async (folderPath: string): Promise<FileMetadata[]> => {
  try {
    const folderRef = ref(storage, folderPath);
    const listResult = await listAll(folderRef);

    const files = await Promise.all(
      listResult.items.map(async (itemRef) => {
        const metadata = await getMetadata(itemRef);
        const downloadUrl = await firebaseGetDownloadURL(itemRef);

        return {
          name: metadata.name,
          size: metadata.size,
          contentType: metadata.contentType,
          timeCreated: metadata.timeCreated,
          updated: metadata.updated,
          fullPath: metadata.fullPath,
          downloadUrl,
        };
      })
    );

    return files;
  } catch {
    return [];
  }
};

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file before upload
 */
export const validateFile = (
  file: File,
  options: ValidationOptions = {}
): ValidationResult => {
  const { maxSizeMB = 10, allowedTypes = [] } = options;

  // Check file size
  if (!validateFileSize(file, maxSizeMB)) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit.`,
    };
  }

  // Check file type if restrictions specified
  if (allowedTypes.length > 0 && !validateFileType(file, allowedTypes)) {
    return {
      valid: false,
      error: `File type not allowed. Accepted types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
};

/**
 * Preset validation configurations
 */
export const VALIDATION_PRESETS = {
  profileImage: {
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  portfolioImage: {
    maxSizeMB: 15,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  video: {
    maxSizeMB: 100,
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
  audio: {
    maxSizeMB: 50,
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
  },
  document: {
    maxSizeMB: 25,
    allowedTypes: ['application/pdf', '.doc', '.docx'],
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export { storage, STORAGE_PATHS };
