/**
 * Firebase Module Exports
 * Club BZR - Experimental Art Community
 *
 * Central export point for all Firebase functionality
 */

// Configuration
export {
  app,
  auth,
  db,
  storage,
  analytics,
  initializeAnalytics,
  COLLECTIONS,
  STORAGE_PATHS,
} from './config';

// Schema types
export type {
  // Base types
  FirestoreTimestamp,
  DateField,
  BaseDocument,
  UserRole,
  ReactionType,
  Reactions,
  MediaType,
  ArtMedium,
  SessionType,
  QuestCategory,
  QuestDifficulty,
  SessionStatus,
  ArtLocationType,
  RadioContentType,
  NotificationType,

  // User & Profile
  User,
  SocialLinks,
  UserPreferences,
  CreativePassport,
  CollaborationRecord,
  StreakData,
  Badge,
  TimelineEvent,
  PassportStats,

  // Artist
  Artist,
  PortfolioItem,
  ArtistAvailability,

  // Sessions
  Session,
  SessionLocation,
  FacilitatorInfo,
  GalleryItem,
  SessionReflection,
  SessionResource,

  // Quests
  Quest,
  QuestConstraint,
  QuestSubmission,

  // Community
  CommunityPost,
  Comment,
  Exhibition,
  CuratorInfo,
  ExhibitionArtwork,

  // Art Map
  ArtLocation,
  OperatingHours,
  DayHours,

  // Radio
  RadioContent,
  RadioArtist,
  TracklistItem,

  // Notifications
  Notification,

  // Utility types
  CreateDocument,
  UpdateDocument,
  StoredDocument,
  PaginationCursor,
  QueryFilters,
  CollectionTypes,
  CollectionName,
} from './schema';

// Authentication
export {
  signInWithGoogle,
  linkGoogleAccount,
  signUpWithEmail,
  signInWithEmail,
  resetPassword,
  resendEmailVerification,
  signOut,
  getCurrentUser,
  isAuthenticated,
  onAuthStateChange,
  getSignInMethodsForEmail,
  updateProfile,
  updateUserEmail,
  updateUserPassword,
  reauthenticate,
  deleteAccount,
  getUserDocument,
  getUserRole,
  hasRole,
  updateUserRole,
} from './authentication';

export type {
  AuthUser,
  SignUpData,
  SignInData,
  UpdateProfileData,
  AuthResult,
  AuthErrorInfo,
} from './authentication';

// Firestore operations
export {
  // CRUD
  getDocument,
  createDocument,
  createDocumentWithId,
  updateDocument,
  deleteDocument,
  documentExists,

  // Queries
  getCollection,
  getPaginatedCollection,
  getDocumentCount,

  // Real-time
  subscribeToDocument,
  subscribeToCollection,

  // Batch & Transactions
  executeBatch,
  executeTransaction,

  // Field helpers
  incrementField,
  addToArray,
  removeFromArray,

  // Query builder
  QueryBuilder,
  createQuery,

  // Re-exports from Firestore SDK
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from './firestore';

export type {
  QueryOptions,
  WhereClause,
  PaginatedResult,
  BatchOperation,
  FirestoreError,
  OperationResult,
} from './firestore';

// Storage operations
export {
  // Upload
  uploadFile,
  uploadFileSimple,
  uploadMultiple,
  uploadDataUrl,

  // Download
  getDownloadURL,
  getFileMetadata,

  // Delete
  deleteFile,
  deleteMultiple,
  deleteFolder,

  // List
  listFiles,

  // Image processing
  compressImage,
  generateThumbnail,

  // Validation
  validateFile,
  VALIDATION_PRESETS,
} from './storage';

export type {
  UploadProgress,
  UploadResult,
  MultipleUploadResult,
  StorageError,
  FileMetadata,
  ImageCompressionOptions,
  StoragePath,
  ValidationOptions,
  ValidationResult,
} from './storage';
