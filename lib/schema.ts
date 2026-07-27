/**
 * Firebase Schema Definitions
 * Club BZR - Experimental Art Community
 *
 * TypeScript interfaces for all Firestore collections
 */

import { Timestamp, FieldValue, GeoPoint } from 'firebase/firestore';

// =============================================================================
// BASE TYPES
// =============================================================================

/** Firestore timestamp type that can be a Timestamp or FieldValue for write operations */
export type FirestoreTimestamp = Timestamp | FieldValue;

/** Date field that can be Date, Timestamp, or FieldValue */
export type DateField = Date | Timestamp | FieldValue;

/** Base interface for all documents */
export interface BaseDocument {
  id: string;
  createdAt: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/** User roles in the system */
export type UserRole = 'user' | 'artist' | 'facilitator' | 'curator' | 'admin';

/** Reaction types */
export type ReactionType = 'love' | 'fire' | 'mind_blown' | 'inspire' | 'curious';

/** Reactions map */
export interface Reactions {
  [reactionType: string]: string[]; // Array of user IDs who reacted
}

/** Media type enumeration */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'link';

/** Art mediums */
export type ArtMedium =
  | 'painting'
  | 'sculpture'
  | 'photography'
  | 'digital'
  | 'illustration'
  | 'mixed_media'
  | 'installation'
  | 'performance'
  | 'video'
  | 'animation'
  | 'textile'
  | 'ceramics'
  | 'printmaking'
  | 'collage'
  | 'street_art'
  | 'conceptual'
  | 'other';

/** Session/Event types */
export type SessionType =
  | 'workshop'
  | 'exhibition'
  | 'open_studio'
  | 'critique'
  | 'talk'
  | 'collaboration'
  | 'field_trip'
  | 'social'
  | 'online';

/** Quest categories */
export type QuestCategory =
  | 'daily_prompt'
  | 'weekly_challenge'
  | 'collaboration'
  | 'exploration'
  | 'skill_building'
  | 'community'
  | 'experimental';

/** Quest difficulty levels */
export type QuestDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'any';

/** Session status */
export type SessionStatus = 'draft' | 'published' | 'cancelled' | 'completed';

/** Session access control */
export type SessionAccessMode = 'open' | 'invite_only';

/** Session payment requirement */
export type SessionPaymentMode = 'free' | 'paid';

/** Payment provider for paid sessions */
export type SessionPaymentProvider = 'none' | 'manual_external' | 'lenco';

/** Whether signups are confirmed automatically or by admin review */
export type SessionApprovalMode = 'auto' | 'manual';

/** Registration lifecycle status */
export type SessionRegistrationStatus =
  | 'requested'
  | 'pending_payment'
  | 'paid_pending_confirmation'
  | 'confirmed'
  | 'waitlisted'
  | 'declined'
  | 'cancelled';

/** Registration payment status */
export type SessionRegistrationPaymentStatus =
  | 'not_required'
  | 'unpaid'
  | 'pending'
  | 'paid_online'
  | 'paid_external'
  | 'waived'
  | 'failed';

/** Manual or online payment method */
export type SessionRegistrationPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'mobile_money'
  | 'card'
  | 'other';

/** Art location types */
export type ArtLocationType =
  | 'gallery'
  | 'museum'
  | 'studio'
  | 'street_art'
  | 'installation'
  | 'pop_up'
  | 'public_art'
  | 'cafe'
  | 'community_space'
  | 'other';

/** Radio content types */
export type RadioContentType =
  | 'mix'
  | 'interview'
  | 'ambient'
  | 'podcast'
  | 'live_session'
  | 'playlist';

// =============================================================================
// USER & PROFILE SCHEMAS
// =============================================================================

/**
 * User - Core user account data
 * Stored in: /users/{uid}
 */
export interface User extends BaseDocument {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phone?: string;
  whatsappPhone?: string;
  role: UserRole;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks;
  preferences?: UserPreferences;
  lovedArtworkKeys?: string[];
  bookmarkedArtworkKeys?: string[];
  isOnboarded: boolean;
  isActive: boolean;
  lastActiveAt?: FirestoreTimestamp;
}

/** Social media links */
export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  website?: string;
  behance?: string;
  dribbble?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
}

/** User notification and display preferences */
export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  questReminders: boolean;
  eventReminders: boolean;
  communityDigest: 'daily' | 'weekly' | 'never';
  theme: 'light' | 'dark' | 'system';
}

/**
 * Creative Passport - Gamification and activity tracking
 * Stored in: /creativePassports/{userId}
 */
export interface CreativePassport extends BaseDocument {
  userId: string;

  // Activity tracking
  eventsAttended: string[]; // Session IDs
  questsCompleted: string[]; // Quest IDs
  questsInProgress: string[]; // Quest IDs

  // Creative profile
  mediums: ArtMedium[];
  interests: string[];
  collaborations: CollaborationRecord[];

  // Gamification
  streaks: StreakData;
  badges: Badge[];
  points: number;
  level: number;

  // Activity timeline
  timeline: TimelineEvent[];

  // Statistics
  stats: PassportStats;
}

/** Collaboration record */
export interface CollaborationRecord {
  id: string;
  collaboratorIds: string[];
  projectTitle: string;
  description?: string;
  mediaUrls?: string[];
  date: FirestoreTimestamp;
}

/** Streak tracking data */
export interface StreakData {
  current: number;
  longest: number;
  lastActivityDate: FirestoreTimestamp;
  weeklyGoal: number;
  weeklyProgress: number;
}

/** Badge earned by user */
export interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  earnedAt: FirestoreTimestamp;
  category: 'participation' | 'creation' | 'community' | 'achievement' | 'special';
}

/** Timeline event for activity feed */
export interface TimelineEvent {
  id: string;
  type: 'quest_completed' | 'event_attended' | 'badge_earned' | 'collaboration' | 'post_created' | 'level_up';
  title: string;
  description?: string;
  referenceId?: string;
  timestamp: FirestoreTimestamp;
}

/** Passport statistics */
export interface PassportStats {
  totalEventsAttended: number;
  totalQuestsCompleted: number;
  totalCollaborations: number;
  totalPostsCreated: number;
  totalReactionsReceived: number;
  joinedAt: FirestoreTimestamp;
}

// =============================================================================
// ARTIST SCHEMA
// =============================================================================

/**
 * Artist - Extended profile for verified artists
 * Stored in: /artists/{artistId}
 */
export interface Artist extends BaseDocument {
  userId: string;
  name: string;
  artistName?: string; // Stage name or artist alias
  photoURL?: string;
  bio: string;
  statement?: string; // Artist statement

  // Creative info
  mediums: ArtMedium[];
  styles?: string[];
  influences?: string[];

  // Portfolio
  portfolio: PortfolioItem[];
  featuredWork?: PortfolioItem;

  // Collaboration
  interests: string[];
  collaborationGoals: string[];
  openToCollaboration: boolean;
  availability: ArtistAvailability;

  // Links
  socialLinks: SocialLinks;
  portfolioUrl?: string;

  // Status
  featured: boolean;
  verified: boolean;
  featuredUntil?: FirestoreTimestamp;

  // Statistics
  followersCount: number;
  worksCount: number;
}

/**
 * Artist Follow - Persistent follow relationship
 * Stored in: /artistFollows/{userId}_{artistId}
 */
export interface ArtistFollow extends BaseDocument {
  userId: string;
  artistId: string;
}

/** Portfolio item */
export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  medium: ArtMedium;
  year?: number;
  mediaUrls: string[];
  thumbnailUrl: string;
  externalUrl?: string;
  featured: boolean;
  order: number;
}

/**
 * Artwork - Public artwork uploaded by artists
 * Stored in: /artworks/{artworkId}
 */
export interface Artwork extends BaseDocument {
  artistId?: string;
  artistName: string;
  artistPhotoURL?: string;
  artistExternalUrl?: string;
  creditType?: 'club_artist' | 'external_credit';

  title: string;
  description?: string;
  medium: ArtMedium;
  imageUrl: string;
  thumbnailUrl?: string;
  mediaUrls: string[];

  genres: string[];
  tags: string[];
  location?: string;
  artworkDate?: FirestoreTimestamp;
  year?: number;

  featured: boolean;
  visibility: 'public' | 'unlisted';
  likesCount: number;
  savesCount: number;
}

/** Artist availability status */
export interface ArtistAvailability {
  forCommissions: boolean;
  forCollaborations: boolean;
  forEvents: boolean;
  notes?: string;
}

// =============================================================================
// EVENTS/SESSIONS SCHEMA
// =============================================================================

/**
 * Session - Events, workshops, and gatherings
 * Stored in: /sessions/{sessionId}
 */
export interface Session extends BaseDocument {
  title: string;
  description: string;
  shortDescription?: string;
  about?: string;

  // Event details
  type: SessionType;
  date: FirestoreTimestamp;
  endDate?: FirestoreTimestamp;
  duration?: number; // in minutes

  // Location
  location: SessionLocation;
  isOnline: boolean;
  onlineUrl?: string;

  // Capacity
  capacity: number;
  attendees: string[]; // User IDs
  waitlist: string[]; // User IDs

  // Organizer
  facilitator: FacilitatorInfo;
  coFacilitators?: FacilitatorInfo[];

  // Content
  coverImage?: string;
  gallery: GalleryItem[];
  materials?: string[];
  requirements?: string[];

  // Post-event
  reflections: SessionReflection[];
  recording?: string;
  resources?: SessionResource[];

  // Meta
  status: SessionStatus;
  featured: boolean;
  tags: string[];
  series?: string; // Series ID if part of a series

  // Registration
  registrationDeadline?: FirestoreTimestamp;
  accessMode?: SessionAccessMode;
  paymentMode?: SessionPaymentMode;
  paymentProvider?: SessionPaymentProvider;
  approvalMode?: SessionApprovalMode;
  paymentInstructions?: string;
  isFree: boolean;
  price?: number;
  currency?: string;
}

/**
 * Session Registration - Signup and payment/confirmation state
 * Stored in: /sessionRegistrations/{registrationId}
 */
export interface SessionRegistration extends BaseDocument {
  sessionId: string;
  userId: string;
  displayName: string;
  email: string;
  phone?: string;
  whatsappPhone?: string;
  photoURL?: string | null;

  status: SessionRegistrationStatus;
  paymentStatus: SessionRegistrationPaymentStatus;
  paymentMethod?: SessionRegistrationPaymentMethod;
  paymentReference?: string;
  paymentNotes?: string;
  paymentTransactionId?: string;
  paymentAmount?: number;
  paymentCurrency?: string;

  requestedAt: FirestoreTimestamp;
  paidAt?: FirestoreTimestamp;
  confirmedAt?: FirestoreTimestamp;
  confirmedBy?: string;
  confirmationEmailSentAt?: FirestoreTimestamp;
  confirmationWhatsAppSentAt?: FirestoreTimestamp;
  confirmationWhatsAppMessageId?: string | null;
  confirmationWhatsAppSkippedAt?: FirestoreTimestamp;
  confirmationWhatsAppSkipReason?: string;
  confirmationWhatsAppFailedAt?: FirestoreTimestamp;
  confirmationWhatsAppError?: string;
  declinedAt?: FirestoreTimestamp;
  declinedBy?: string;
  cancelledAt?: FirestoreTimestamp;
  cancelledBy?: string;
  adminNotes?: string;
}

/** Session location details */
export interface SessionLocation {
  name: string;
  address?: string;
  city?: string;
  coordinates?: GeoPoint;
  instructions?: string;
}

/** Facilitator info */
export interface FacilitatorInfo {
  userId: string;
  name: string;
  photoURL?: string;
  bio?: string;
}

/** Gallery item */
export interface GalleryItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  credit?: string;
  uploadedBy: string;
  uploadedAt: FirestoreTimestamp;
}

/** Session reflection from attendee */
export interface SessionReflection {
  id: string;
  userId: string;
  userName: string;
  content: string;
  rating?: number;
  createdAt: FirestoreTimestamp;
}

/** Session resource */
export interface SessionResource {
  id: string;
  title: string;
  type: 'link' | 'document' | 'video';
  url: string;
  description?: string;
}

// =============================================================================
// SIDE QUESTS SCHEMA
// =============================================================================

/**
 * Quest - Creative challenges and prompts
 * Stored in: /quests/{questId}
 */
export interface Quest extends BaseDocument {
  title: string;
  description: string;

  // Quest details
  category: QuestCategory;
  difficulty: QuestDifficulty;
  estimatedTime?: string; // e.g., "30 mins", "1-2 hours"

  // Creative constraints
  constraints: QuestConstraint[];
  inspirationLinks?: string[];
  exampleImages?: string[];

  // Timing
  startDate?: FirestoreTimestamp;
  endDate?: FirestoreTimestamp;
  isActive: boolean;

  // Submissions
  submissions: string[]; // Submission IDs
  submissionCount: number;

  // Rewards
  points: number;
  badges?: string[]; // Badge IDs that can be earned

  // Meta
  featured: boolean;
  createdBy: string; // User ID
  tags: string[];
}

/** Quest constraint */
export interface QuestConstraint {
  type: 'medium' | 'time' | 'color' | 'theme' | 'material' | 'size' | 'collaboration' | 'other';
  description: string;
  required: boolean;
}

/**
 * Quest Submission - User submission to a quest
 * Stored in: /questSubmissions/{submissionId}
 */
export interface QuestSubmission extends BaseDocument {
  questId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;

  // Content
  title?: string;
  content: string; // Description or artist statement
  mediaUrls: string[];
  mediaType: MediaType;
  thumbnailUrl?: string;

  // Engagement
  reactions: Reactions;
  reactionsCount: number;
  commentsCount: number;
  upvotes?: string[];
  downvotes?: string[];
  upvotesCount?: number;
  downvotesCount?: number;
  voteScore?: number;

  // Status
  featured: boolean;
  approved: boolean;
  showOnWall?: boolean;

  // Points
  pointsAwarded: number;

  // Denormalized display fields
  questTitle?: string;
}

// =============================================================================
// COMMUNITY SCHEMA
// =============================================================================

/**
 * Community Post - Social feed posts
 * Stored in: /communityPosts/{postId}
 */
export interface CommunityPost extends BaseDocument {
  userId: string;
  userName: string;
  userPhotoURL?: string;

  // Content
  prompt?: string; // If responding to a prompt
  content: string;
  mediaUrls: string[];
  mediaType: MediaType | null;

  // Engagement
  reactions: Reactions;
  reactionsCount: number;
  comments: string[]; // Comment IDs
  commentsCount: number;

  // Sharing
  shares: number;

  // Meta
  featured: boolean;
  pinned: boolean;
  tags: string[];

  // Moderation
  isApproved: boolean;
  isHidden: boolean;
}

/**
 * Comment - Comments on posts and submissions
 * Stored in: /comments/{commentId}
 */
export interface Comment extends BaseDocument {
  parentId: string;
  parentType: 'post' | 'submission' | 'session' | 'exhibition';

  userId: string;
  userName: string;
  userPhotoURL?: string;

  content: string;

  reactions: Reactions;
  reactionsCount: number;

  // Threading
  replyTo?: string; // Parent comment ID for nested replies
  repliesCount: number;

  isEdited: boolean;
  editedAt?: FirestoreTimestamp;
}

/**
 * Exhibition - Curated art showcases
 * Stored in: /exhibitions/{exhibitionId}
 */
export interface Exhibition extends BaseDocument {
  title: string;
  description: string;
  curatorStatement?: string;

  // Curator info
  curator: CuratorInfo;
  coCurators?: CuratorInfo[];

  // Artworks
  artworks: ExhibitionArtwork[];

  // Timing
  startDate: FirestoreTimestamp;
  endDate: FirestoreTimestamp;

  // Display
  coverImage: string;
  featured: boolean;

  // Location (if physical)
  isOnline: boolean;
  location?: SessionLocation;
  virtualTourUrl?: string;

  // Meta
  tags: string[];
  viewsCount: number;
}

/** Curator info */
export interface CuratorInfo {
  userId: string;
  name: string;
  photoURL?: string;
  bio?: string;
}

/** Exhibition artwork */
export interface ExhibitionArtwork {
  id: string;
  artistId?: string;
  artistName: string;
  artistPhotoURL?: string;
  artistExternalUrl?: string;
  creditType?: 'club_artist' | 'external_credit';

  title: string;
  description?: string;
  medium: ArtMedium;
  year?: number;

  mediaUrls: string[];
  thumbnailUrl: string;

  order: number;
  curatorNote?: string;

  // Engagement
  likedBy?: string[];
  likesCount?: number;
  savedBy?: string[];
  savesCount?: number;
  sharesCount?: number;
}

// =============================================================================
// ART MAP SCHEMA
// =============================================================================

/**
 * Art Location - Places on the art map
 * Stored in: /artLocations/{locationId}
 */
export interface ArtLocation extends BaseDocument {
  name: string;
  type: ArtLocationType;

  // Location
  coordinates: GeoPoint;
  address: string;
  city: string;
  country: string;
  neighborhood?: string;

  // Details
  description: string;
  images: string[];
  thumbnailUrl?: string;

  // Contact
  website?: string;
  phone?: string;
  email?: string;
  socialLinks?: SocialLinks;

  // Hours
  hours?: OperatingHours;

  // Submission info
  submittedBy: string;
  submittedByName: string;

  // Verification
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: FirestoreTimestamp;

  // Engagement
  savedBy: string[]; // User IDs who saved this location
  savesCount: number;
  visitedBy: string[]; // User IDs who marked as visited
  visitsCount: number;

  // Meta
  featured: boolean;
  tags: string[];
  isActive: boolean;
}

/** Operating hours */
export interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  notes?: string;
}

/** Hours for a single day */
export interface DayHours {
  open: string; // "09:00"
  close: string; // "18:00"
  closed?: boolean;
}

// =============================================================================
// RADIO SCHEMA
// =============================================================================

/**
 * Radio Content - Audio content for BZR Radio
 * Stored in: /radioContent/{contentId}
 */
export interface RadioContent extends BaseDocument {
  title: string;
  type: RadioContentType;

  // Audio
  audioUrl: string;
  duration: number; // in seconds
  waveformData?: number[]; // For visualizations

  // Details
  description: string;

  // Artist/Creator
  artist: RadioArtist;
  guests?: RadioArtist[];

  // Cover
  coverImage: string;

  // Timing
  publishedAt: FirestoreTimestamp;
  scheduledFor?: FirestoreTimestamp;

  // Engagement
  playCount: number;
  likesCount: number;
  likedBy: string[];

  // Meta
  featured: boolean;
  isPublished: boolean;
  tags: string[];
  tracklist?: TracklistItem[];
}

/** Radio artist info */
export interface RadioArtist {
  id?: string; // User ID if registered
  name: string;
  photoURL?: string;
  bio?: string;
  socialLinks?: SocialLinks;
}

/** Tracklist item for mixes */
export interface TracklistItem {
  position: number;
  artist: string;
  title: string;
  timestamp?: number; // in seconds
}

// =============================================================================
// NOTIFICATIONS SCHEMA
// =============================================================================

/**
 * Notification - User notifications
 * Stored in: /notifications/{notificationId}
 */
export interface Notification extends BaseDocument {
  userId: string;

  type: NotificationType;
  title: string;
  body: string;

  // Reference
  referenceId?: string;
  referenceType?: 'post' | 'quest' | 'session' | 'user' | 'submission' | 'comment';

  // Sender
  fromUserId?: string;
  fromUserName?: string;
  fromUserPhotoURL?: string;

  // Status
  read: boolean;
  readAt?: FirestoreTimestamp;

  // Action
  actionUrl?: string;
}

/** Notification types */
export type NotificationType =
  | 'reaction'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'quest_reminder'
  | 'event_reminder'
  | 'badge_earned'
  | 'level_up'
  | 'featured'
  | 'system';

// =============================================================================
// MATCHMAKING SCHEMA
// =============================================================================

/** Match status */
export type MatchStatus = 'suggested' | 'pending' | 'connected' | 'declined';

/**
 * Match - Artist matchmaking records
 * Stored in: /matches/{matchId}
 */
export interface Match extends BaseDocument {
  // Users involved
  userId: string;
  matchedUserId: string;

  // Match details
  score: number; // 0-100 match score
  matchedOn: string[]; // Interests/skills that matched

  // Status
  status: MatchStatus;

  // Who initiated (if pending)
  initiatedBy?: string;
  initiatedAt?: FirestoreTimestamp;

  // Connection details (if connected)
  connectedAt?: FirestoreTimestamp;

  // Decline details (if declined)
  declinedAt?: FirestoreTimestamp;
  declinedBy?: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Type for creating a new document (id is auto-generated) */
export type CreateDocument<T extends BaseDocument> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: FirestoreTimestamp;
};

/** Type for updating a document (all fields optional except id) */
export type UpdateDocument<T extends BaseDocument> = Partial<Omit<T, 'id' | 'createdAt'>> & {
  updatedAt?: FirestoreTimestamp;
};

/** Type for documents as stored in Firestore (with server timestamps) */
export type StoredDocument<T extends BaseDocument> = Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

/** Pagination cursor type */
export interface PaginationCursor {
  lastDoc: unknown;
  hasMore: boolean;
}

/** Query filters */
export interface QueryFilters {
  [key: string]: unknown;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  startAfter?: unknown;
}

// =============================================================================
// COLLECTION TYPES MAP
// =============================================================================

/** Map of collection names to their document types */
export interface CollectionTypes {
  users: User;
  creativePassports: CreativePassport;
  artists: Artist;
  artistFollows: ArtistFollow;
  artworks: Artwork;
  sessions: Session;
  sessionRegistrations: SessionRegistration;
  quests: Quest;
  questSubmissions: QuestSubmission;
  communityPosts: CommunityPost;
  comments: Comment;
  exhibitions: Exhibition;
  artLocations: ArtLocation;
  radioContent: RadioContent;
  notifications: Notification;
  matches: Match;
}

export type CollectionName = keyof CollectionTypes;
