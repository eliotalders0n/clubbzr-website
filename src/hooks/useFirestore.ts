/**
 * Firestore React Hooks
 * Club BZR - Experimental Art Community
 *
 * Custom hooks for Firestore operations with loading and error states
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DocumentSnapshot, Unsubscribe } from 'firebase/firestore';

import {
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  getPaginatedCollection,
  subscribeToDocument,
  subscribeToCollection,
  createQuery,
  QueryBuilder,
  type QueryOptions,
  type WhereClause,
  type PaginatedResult,
  type OperationResult,
  type FirestoreError,
} from '../../lib/firestore';
import type {
  BaseDocument,
  CreateDocument,
  UpdateDocument,
  CollectionTypes,
  CollectionName,
} from '../../lib/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface UseDocumentState<T> {
  data: T | null;
  loading: boolean;
  error: FirestoreError | null;
}

export interface UseCollectionState<T> {
  data: T[];
  loading: boolean;
  error: FirestoreError | null;
}

export interface UsePaginationState<T> {
  data: T[];
  loading: boolean;
  error: FirestoreError | null;
  hasMore: boolean;
  hasPrevious: boolean;
  totalCount?: number;
}

export interface UseMutationState {
  loading: boolean;
  error: FirestoreError | null;
}

// =============================================================================
// useDocument Hook
// =============================================================================

/**
 * Hook to fetch a single document
 */
export function useDocument<K extends CollectionName>(
  collectionName: K,
  docId: string | null | undefined,
  options?: {
    skip?: boolean;
  }
): UseDocumentState<CollectionTypes[K]> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<CollectionTypes[K] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);

  const fetch = useCallback(async () => {
    if (!docId || options?.skip) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await getDocument(collectionName, docId);

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || null);
      setData(null);
    }

    setLoading(false);
  }, [collectionName, docId, options?.skip]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// =============================================================================
// useRealtime Hook
// =============================================================================

/**
 * Hook to subscribe to a document in real-time
 */
export function useRealtime<K extends CollectionName>(
  collectionName: K,
  docId: string | null | undefined,
  options?: {
    skip?: boolean;
  }
): UseDocumentState<CollectionTypes[K]> {
  const [data, setData] = useState<CollectionTypes[K] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!docId || options?.skip) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToDocument(
      collectionName,
      docId,
      (docData) => {
        setData(docData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, docId, options?.skip]);

  return { data, loading, error };
}

// =============================================================================
// useCollection Hook
// =============================================================================

/**
 * Hook to fetch a collection with optional filters
 */
export function useCollection<K extends CollectionName>(
  collectionName: K,
  options?: {
    where?: WhereClause[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    skip?: boolean;
  }
): UseCollectionState<CollectionTypes[K]> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<CollectionTypes[K][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);

  // Memoize options to prevent infinite loops
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const optionsKey = JSON.stringify({
    skip: options?.skip ?? false,
    orderBy: options?.orderBy ?? null,
    orderDirection: options?.orderDirection ?? null,
    limit: options?.limit ?? null,
    where: options?.where ?? [],
  });

  const fetch = useCallback(async () => {
    const opts = optionsRef.current;

    if (opts?.skip) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await getCollection(
      collectionName,
      {
        orderByField: opts?.orderBy,
        orderDirection: opts?.orderDirection,
        limitCount: opts?.limit,
      },
      opts?.where
    );

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || null);
      setData([]);
    }

    setLoading(false);
  }, [collectionName]);

  useEffect(() => {
    fetch();
  }, [fetch, optionsKey, collectionName, options?.skip]);

  return { data, loading, error, refetch: fetch };
}

// =============================================================================
// useRealtimeCollection Hook
// =============================================================================

/**
 * Hook to subscribe to a collection in real-time
 */
export function useRealtimeCollection<K extends CollectionName>(
  collectionName: K,
  options?: {
    where?: WhereClause[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    skip?: boolean;
  }
): UseCollectionState<CollectionTypes[K]> {
  const [data, setData] = useState<CollectionTypes[K][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (options?.skip) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToCollection(
      collectionName,
      (collectionData) => {
        setData(collectionData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      {
        orderByField: options?.orderBy,
        orderDirection: options?.orderDirection,
        limitCount: options?.limit,
      },
      options?.where
    );

    return () => unsubscribe();
  }, [
    collectionName,
    options?.skip,
    options?.orderBy,
    options?.orderDirection,
    options?.limit,
    JSON.stringify(options?.where), // Serialize for comparison
  ]);

  return { data, loading, error };
}

// =============================================================================
// usePagination Hook
// =============================================================================

/**
 * Hook for paginated collection queries
 */
export function usePagination<K extends CollectionName>(
  collectionName: K,
  pageSize: number,
  options?: {
    where?: WhereClause[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    skip?: boolean;
  }
): UsePaginationState<CollectionTypes[K]> & {
  loadMore: () => Promise<void>;
  loadPrevious: () => Promise<void>;
  reset: () => Promise<void>;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<CollectionTypes[K][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);

  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const firstDocRef = useRef<DocumentSnapshot | null>(null);
  const pagesStackRef = useRef<DocumentSnapshot[]>([]);

  const fetchPage = useCallback(
    async (startAfterDoc?: DocumentSnapshot) => {
      if (options?.skip) {
        setData([]);
        return;
      }

      setLoading(true);
      setError(null);

      const result = await getPaginatedCollection(
        collectionName,
        pageSize,
        {
          orderByField: options?.orderBy,
          orderDirection: options?.orderDirection,
          startAfterDoc,
        },
        options?.where
      );

      if (result.success && result.data) {
        setData(result.data.data);
        setHasMore(result.data.hasMore);
        setHasPrevious(result.data.hasPrevious || pagesStackRef.current.length > 0);
        lastDocRef.current = result.data.lastDoc;
        firstDocRef.current = result.data.firstDoc;
      } else {
        setError(result.error || null);
      }

      setLoading(false);
    },
    [collectionName, pageSize, options?.orderBy, options?.orderDirection, options?.skip]
  );

  // Initial fetch
  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !lastDocRef.current) return;

    // Save current first doc for going back
    if (firstDocRef.current) {
      pagesStackRef.current.push(firstDocRef.current);
    }

    await fetchPage(lastDocRef.current);
  }, [hasMore, loading, fetchPage]);

  const loadPrevious = useCallback(async () => {
    if (!hasPrevious || loading) return;

    const previousPageDoc = pagesStackRef.current.pop();

    if (previousPageDoc) {
      await fetchPage(previousPageDoc);
    } else {
      // Go to first page
      await fetchPage();
    }
  }, [hasPrevious, loading, fetchPage]);

  const reset = useCallback(async () => {
    lastDocRef.current = null;
    firstDocRef.current = null;
    pagesStackRef.current = [];
    setHasPrevious(false);
    await fetchPage();
  }, [fetchPage]);

  return {
    data,
    loading,
    error,
    hasMore,
    hasPrevious,
    loadMore,
    loadPrevious,
    reset,
    refetch: reset,
  };
}

// =============================================================================
// useInfinitePagination Hook
// =============================================================================

/**
 * Hook for infinite scroll pagination (accumulates results)
 */
export function useInfinitePagination<K extends CollectionName>(
  collectionName: K,
  pageSize: number,
  options?: {
    where?: WhereClause[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    skip?: boolean;
  }
): UsePaginationState<CollectionTypes[K]> & {
  loadMore: () => Promise<void>;
  reset: () => Promise<void>;
} {
  const [data, setData] = useState<CollectionTypes[K][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const isFirstLoad = useRef(true);

  const fetchPage = useCallback(
    async (startAfterDoc?: DocumentSnapshot, append: boolean = false) => {
      if (options?.skip) {
        setData([]);
        return;
      }

      setLoading(true);
      setError(null);

      const result = await getPaginatedCollection(
        collectionName,
        pageSize,
        {
          orderByField: options?.orderBy,
          orderDirection: options?.orderDirection,
          startAfterDoc,
        },
        options?.where
      );

      if (result.success && result.data) {
        if (append) {
          setData((prev) => [...prev, ...result.data!.data]);
        } else {
          setData(result.data.data);
        }
        setHasMore(result.data.hasMore);
        lastDocRef.current = result.data.lastDoc;
      } else {
        setError(result.error || null);
      }

      setLoading(false);
    },
    [collectionName, pageSize, options?.orderBy, options?.orderDirection, options?.skip]
  );

  // Initial fetch
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      fetchPage();
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !lastDocRef.current) return;
    await fetchPage(lastDocRef.current, true);
  }, [hasMore, loading, fetchPage]);

  const reset = useCallback(async () => {
    lastDocRef.current = null;
    isFirstLoad.current = true;
    setData([]);
    await fetchPage();
  }, [fetchPage]);

  return {
    data,
    loading,
    error,
    hasMore,
    hasPrevious: false,
    loadMore,
    reset,
  };
}

// =============================================================================
// useSearch Hook
// =============================================================================

/**
 * Hook for search functionality
 * Note: For full-text search, consider using Algolia or Meilisearch
 * This provides basic field-based searching
 */
export function useSearch<K extends CollectionName>(
  collectionName: K,
  searchField: string,
  options?: {
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): UseCollectionState<CollectionTypes[K]> & {
  search: (query: string) => Promise<void>;
  clear: () => void;
} {
  const [data, setData] = useState<CollectionTypes[K][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setData([]);
        return;
      }

      setLoading(true);
      setError(null);

      // Firestore prefix search using >= and <
      const searchEnd = query + '';

      const result = await getCollection(
        collectionName,
        {
          orderByField: options?.orderBy || searchField,
          orderDirection: options?.orderDirection,
          limitCount: options?.limit || 20,
        },
        [
          { field: searchField, operator: '>=', value: query },
          { field: searchField, operator: '<', value: searchEnd },
        ]
      );

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || null);
        setData([]);
      }

      setLoading(false);
    },
    [collectionName, searchField, options?.orderBy, options?.orderDirection, options?.limit]
  );

  const clear = useCallback(() => {
    setData([]);
    setError(null);
  }, []);

  return { data, loading, error, search, clear };
}

// =============================================================================
// useMutation Hook
// =============================================================================

/**
 * Generic mutation hook for create/update/delete operations
 */
export function useMutation<K extends CollectionName>(
  collectionName: K
): UseMutationState & {
  create: (data: CreateDocument<CollectionTypes[K]>) => Promise<OperationResult<CollectionTypes[K]>>;
  update: (
    docId: string,
    data: UpdateDocument<CollectionTypes[K]>
  ) => Promise<OperationResult<CollectionTypes[K]>>;
  remove: (docId: string) => Promise<OperationResult>;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);

  const create = useCallback(
    async (data: CreateDocument<CollectionTypes[K]>) => {
      setLoading(true);
      setError(null);

      const result = await createDocument(collectionName, data);

      if (!result.success) {
        setError(result.error || null);
      }

      setLoading(false);
      return result;
    },
    [collectionName]
  );

  const update = useCallback(
    async (docId: string, data: UpdateDocument<CollectionTypes[K]>) => {
      setLoading(true);
      setError(null);

      const result = await updateDocument(collectionName, docId, data);

      if (!result.success) {
        setError(result.error || null);
      }

      setLoading(false);
      return result;
    },
    [collectionName]
  );

  const remove = useCallback(
    async (docId: string) => {
      setLoading(true);
      setError(null);

      const result = await deleteDocument(collectionName, docId);

      if (!result.success) {
        setError(result.error || null);
      }

      setLoading(false);
      return result;
    },
    [collectionName]
  );

  return { loading, error, create, update, remove };
}

// =============================================================================
// useQuery Hook
// =============================================================================

/**
 * Hook using QueryBuilder for complex queries
 */
export function useQuery<K extends CollectionName>(
  collectionName: K,
  buildQuery: (builder: QueryBuilder<K>) => QueryBuilder<K>,
  deps: unknown[] = []
): UseCollectionState<CollectionTypes[K]> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<CollectionTypes[K][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const builder = createQuery(collectionName);
    const configuredBuilder = buildQuery(builder);
    const result = await configuredBuilder.get();

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || null);
      setData([]);
    }

    setLoading(false);
  }, [collectionName, ...deps]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Types from firestore
  type QueryOptions,
  type WhereClause,
  type PaginatedResult,
  type OperationResult,
  type FirestoreError,
};
