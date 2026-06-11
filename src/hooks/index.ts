// Animation hooks
export {
  useScrollProgress,
  useParallax,
  useMousePosition,
  useInView,
  useMagneticEffect,
  useGSAPAnimation,
  useScrollVelocity,
  useElementSize,
  useReducedMotion,
  useRaf,
  useTilt,
  framerUseInView,
} from './useAnimation';

// Firestore hooks
export {
  useDocument,
  useRealtime,
  useCollection,
  useRealtimeCollection,
  usePagination,
  useInfinitePagination,
  useSearch,
  useMutation,
  useQuery,
} from './useFirestore';

export type {
  UseDocumentState,
  UseCollectionState,
  UsePaginationState,
  UseMutationState,
  QueryOptions,
  WhereClause,
  PaginatedResult,
  OperationResult,
  FirestoreError,
} from './useFirestore';
