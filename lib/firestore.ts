/**
 * Firebase Firestore Operations
 * Club BZR - Experimental Art Community
 *
 * Type-safe CRUD operations, queries, and real-time listeners
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  onSnapshot,
  writeBatch,
  runTransaction,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
  QuerySnapshot,
  QueryConstraint,
  DocumentData,
  Unsubscribe,
  WhereFilterOp,
  OrderByDirection,
  getCountFromServer,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from './config';
import type {
  BaseDocument,
  CreateDocument,
  UpdateDocument,
  CollectionTypes,
  CollectionName,
} from './schema';

// =============================================================================
// TYPES
// =============================================================================

export interface QueryOptions {
  orderByField?: string;
  orderDirection?: OrderByDirection;
  limitCount?: number;
  startAfterDoc?: DocumentSnapshot;
  endBeforeDoc?: DocumentSnapshot;
}

export interface WhereClause {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  firstDoc: DocumentSnapshot | null;
  hasMore: boolean;
  hasPrevious: boolean;
  totalCount?: number;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId?: string;
  data?: DocumentData;
}

export interface FirestoreError {
  code: string;
  message: string;
}

export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: FirestoreError;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Parse Firestore error */
const parseError = (error: unknown): FirestoreError => {
  const err = error as { code?: string; message?: string };
  return {
    code: err?.code || 'unknown',
    message: err?.message || 'An unexpected error occurred.',
  };
};

/** Convert Firestore document to typed object */
const docToObject = <T extends BaseDocument>(
  docSnap: DocumentSnapshot | QueryDocumentSnapshot
): T | null => {
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
  } as T;
};

/** Convert query snapshot to array of typed objects */
const queryToArray = <T extends BaseDocument>(
  querySnap: QuerySnapshot
): T[] => {
  return querySnap.docs.map((doc) => docToObject<T>(doc)!).filter(Boolean);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const stripUndefined = (value: unknown): unknown => {
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefined(entry))
      .filter((entry) => entry !== undefined);
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((cleaned, [key, entry]) => {
      const cleanedEntry = stripUndefined(entry);
      if (cleanedEntry !== undefined) {
        cleaned[key] = cleanedEntry;
      }
      return cleaned;
    }, {});
  }

  return value;
};

// =============================================================================
// GENERIC CRUD OPERATIONS
// =============================================================================

/**
 * Get a single document by ID
 */
export const getDocument = async <K extends CollectionName>(
  collectionName: K,
  docId: string
): Promise<OperationResult<CollectionTypes[K]>> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: { code: 'not-found', message: 'Document not found' } };
    }

    const data = docToObject<CollectionTypes[K]>(docSnap);
    return { success: true, data: data! };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Create a new document with auto-generated ID
 */
export const createDocument = async <K extends CollectionName>(
  collectionName: K,
  data: CreateDocument<CollectionTypes[K]>
): Promise<OperationResult<CollectionTypes[K]>> => {
  try {
    const collRef = collection(db, collectionName);
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collRef, stripUndefined(docData) as DocumentData);
    const newDoc = await getDoc(docRef);

    return {
      success: true,
      data: docToObject<CollectionTypes[K]>(newDoc)!,
    };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Create a document with specific ID
 */
export const createDocumentWithId = async <K extends CollectionName>(
  collectionName: K,
  docId: string,
  data: CreateDocument<CollectionTypes[K]>
): Promise<OperationResult<CollectionTypes[K]>> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, stripUndefined(docData) as DocumentData);
    const newDoc = await getDoc(docRef);

    return {
      success: true,
      data: docToObject<CollectionTypes[K]>(newDoc)!,
    };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Update an existing document
 */
export const updateDocument = async <K extends CollectionName>(
  collectionName: K,
  docId: string,
  data: UpdateDocument<CollectionTypes[K]>
): Promise<OperationResult<CollectionTypes[K]>> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, stripUndefined(updateData) as DocumentData);
    const updatedDoc = await getDoc(docRef);

    return {
      success: true,
      data: docToObject<CollectionTypes[K]>(updatedDoc)!,
    };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  collectionName: CollectionName,
  docId: string
): Promise<OperationResult> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Check if document exists
 */
export const documentExists = async (
  collectionName: CollectionName,
  docId: string
): Promise<boolean> => {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
};

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get all documents in a collection with optional filters
 */
export const getCollection = async <K extends CollectionName>(
  collectionName: K,
  options?: QueryOptions,
  whereClauses?: WhereClause[]
): Promise<OperationResult<CollectionTypes[K][]>> => {
  try {
    const constraints: QueryConstraint[] = [];

    // Add where clauses
    if (whereClauses) {
      whereClauses.forEach((clause) => {
        constraints.push(where(clause.field, clause.operator, clause.value));
      });
    }

    // Add ordering
    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
    }

    // Add pagination
    if (options?.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }
    if (options?.endBeforeDoc) {
      constraints.push(endBefore(options.endBeforeDoc));
    }

    // Add limit
    if (options?.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const collRef = collection(db, collectionName);
    const q = query(collRef, ...constraints);
    const querySnap = await getDocs(q);

    return {
      success: true,
      data: queryToArray<CollectionTypes[K]>(querySnap),
    };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Get paginated documents
 */
export const getPaginatedCollection = async <K extends CollectionName>(
  collectionName: K,
  pageSize: number,
  options?: Omit<QueryOptions, 'limitCount'>,
  whereClauses?: WhereClause[]
): Promise<OperationResult<PaginatedResult<CollectionTypes[K]>>> => {
  try {
    const constraints: QueryConstraint[] = [];

    // Add where clauses
    if (whereClauses) {
      whereClauses.forEach((clause) => {
        constraints.push(where(clause.field, clause.operator, clause.value));
      });
    }

    // Add ordering
    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
    }

    // Add pagination cursor
    if (options?.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    // Fetch one extra to check if there are more
    constraints.push(limit(pageSize + 1));

    const collRef = collection(db, collectionName);
    const q = query(collRef, ...constraints);
    const querySnap = await getDocs(q);

    const docs = querySnap.docs;
    const hasMore = docs.length > pageSize;

    // Remove the extra document if present
    if (hasMore) {
      docs.pop();
    }

    const data = docs.map((doc) => docToObject<CollectionTypes[K]>(doc)!);

    return {
      success: true,
      data: {
        data,
        lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
        firstDoc: docs.length > 0 ? docs[0] : null,
        hasMore,
        hasPrevious: !!options?.startAfterDoc,
      },
    };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Get count of documents matching query
 */
export const getDocumentCount = async (
  collectionName: CollectionName,
  whereClauses?: WhereClause[]
): Promise<OperationResult<number>> => {
  try {
    const constraints: QueryConstraint[] = [];

    if (whereClauses) {
      whereClauses.forEach((clause) => {
        constraints.push(where(clause.field, clause.operator, clause.value));
      });
    }

    const collRef = collection(db, collectionName);
    const q = query(collRef, ...constraints);
    const snapshot = await getCountFromServer(q);

    return {
      success: true,
      data: snapshot.data().count,
    };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// =============================================================================
// REAL-TIME LISTENERS
// =============================================================================

/**
 * Subscribe to a single document
 */
export const subscribeToDocument = <K extends CollectionName>(
  collectionName: K,
  docId: string,
  onData: (data: CollectionTypes[K] | null) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe => {
  const docRef = doc(db, collectionName, docId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      onData(docToObject<CollectionTypes[K]>(docSnap));
    },
    (error) => {
      onError?.(parseError(error));
    }
  );
};

/**
 * Subscribe to a collection with optional filters
 */
export const subscribeToCollection = <K extends CollectionName>(
  collectionName: K,
  onData: (data: CollectionTypes[K][]) => void,
  onError?: (error: FirestoreError) => void,
  options?: QueryOptions,
  whereClauses?: WhereClause[]
): Unsubscribe => {
  const constraints: QueryConstraint[] = [];

  if (whereClauses) {
    whereClauses.forEach((clause) => {
      constraints.push(where(clause.field, clause.operator, clause.value));
    });
  }

  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
  }

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  const collRef = collection(db, collectionName);
  const q = query(collRef, ...constraints);

  return onSnapshot(
    q,
    (querySnap) => {
      onData(queryToArray<CollectionTypes[K]>(querySnap));
    },
    (error) => {
      onError?.(parseError(error));
    }
  );
};

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Execute batch operations
 */
export const executeBatch = async (
  operations: BatchOperation[]
): Promise<OperationResult> => {
  try {
    const batch = writeBatch(db);

    operations.forEach((op) => {
      const docRef = op.docId
        ? doc(db, op.collection, op.docId)
        : doc(collection(db, op.collection));

      switch (op.type) {
        case 'create':
          batch.set(docRef, stripUndefined({
            ...op.data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }) as DocumentData);
          break;
        case 'update':
          batch.update(docRef, stripUndefined({
            ...op.data,
            updatedAt: serverTimestamp(),
          }) as DocumentData);
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Execute a transaction
 */
export const executeTransaction = async <T>(
  updateFn: (transaction: Parameters<Parameters<typeof runTransaction>[1]>[0]) => Promise<T>
): Promise<OperationResult<T>> => {
  try {
    const result = await runTransaction(db, updateFn);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// =============================================================================
// FIELD UPDATE HELPERS
// =============================================================================

/**
 * Increment a numeric field
 */
export const incrementField = async (
  collectionName: CollectionName,
  docId: string,
  field: string,
  amount: number = 1
): Promise<OperationResult> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      [field]: increment(amount),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Add item to array field
 */
export const addToArray = async (
  collectionName: CollectionName,
  docId: string,
  field: string,
  value: unknown
): Promise<OperationResult> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      [field]: arrayUnion(value),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

/**
 * Remove item from array field
 */
export const removeFromArray = async (
  collectionName: CollectionName,
  docId: string,
  field: string,
  value: unknown
): Promise<OperationResult> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      [field]: arrayRemove(value),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// =============================================================================
// QUERY BUILDER
// =============================================================================

/**
 * Query builder class for complex queries
 */
export class QueryBuilder<K extends CollectionName> {
  private collectionName: K;
  private whereClauses: WhereClause[] = [];
  private orderByFields: { field: string; direction: OrderByDirection }[] = [];
  private limitCount?: number;
  private startAfterDoc?: DocumentSnapshot;
  private endBeforeDoc?: DocumentSnapshot;

  constructor(collectionName: K) {
    this.collectionName = collectionName;
  }

  where(field: string, operator: WhereFilterOp, value: unknown): this {
    this.whereClauses.push({ field, operator, value });
    return this;
  }

  orderBy(field: string, direction: OrderByDirection = 'asc'): this {
    this.orderByFields.push({ field, direction });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  startAfter(doc: DocumentSnapshot): this {
    this.startAfterDoc = doc;
    return this;
  }

  endBefore(doc: DocumentSnapshot): this {
    this.endBeforeDoc = doc;
    return this;
  }

  async get(): Promise<OperationResult<CollectionTypes[K][]>> {
    const constraints: QueryConstraint[] = [];

    this.whereClauses.forEach((clause) => {
      constraints.push(where(clause.field, clause.operator, clause.value));
    });

    this.orderByFields.forEach((ob) => {
      constraints.push(orderBy(ob.field, ob.direction));
    });

    if (this.startAfterDoc) {
      constraints.push(startAfter(this.startAfterDoc));
    }

    if (this.endBeforeDoc) {
      constraints.push(endBefore(this.endBeforeDoc));
    }

    if (this.limitCount) {
      constraints.push(limit(this.limitCount));
    }

    try {
      const collRef = collection(db, this.collectionName);
      const q = query(collRef, ...constraints);
      const querySnap = await getDocs(q);

      return {
        success: true,
        data: queryToArray<CollectionTypes[K]>(querySnap),
      };
    } catch (error) {
      return { success: false, error: parseError(error) };
    }
  }

  subscribe(
    onData: (data: CollectionTypes[K][]) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];

    this.whereClauses.forEach((clause) => {
      constraints.push(where(clause.field, clause.operator, clause.value));
    });

    this.orderByFields.forEach((ob) => {
      constraints.push(orderBy(ob.field, ob.direction));
    });

    if (this.limitCount) {
      constraints.push(limit(this.limitCount));
    }

    const collRef = collection(db, this.collectionName);
    const q = query(collRef, ...constraints);

    return onSnapshot(
      q,
      (querySnap) => {
        onData(queryToArray<CollectionTypes[K]>(querySnap));
      },
      (error) => {
        onError?.(parseError(error));
      }
    );
  }
}

/**
 * Create a new query builder
 */
export const createQuery = <K extends CollectionName>(
  collectionName: K
): QueryBuilder<K> => {
  return new QueryBuilder(collectionName);
};

// =============================================================================
// EXPORTS
// =============================================================================

export { db, serverTimestamp, Timestamp, increment, arrayUnion, arrayRemove };
