// Unlimited Storage Manager
// Handles chunked storage, persistent quota, and memory-efficient data operations
// Designed to handle unlimited notes, tasks, media, and files without crashing

const CHUNK_SIZE = 500 * 1024; // 500KB chunks for large media
const MAX_MEMORY_CACHE = 50; // Max items in memory cache
const DB_NAME = 'nota-unlimited-storage';
const DB_VERSION = 2;

interface StorageChunk {
  id: string;
  parentId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;
  createdAt: string;
}

interface StorageMetadata {
  id: string;
  type: 'image' | 'audio' | 'note' | 'file';
  totalSize: number;
  chunkCount: number;
  mimeType?: string;
  createdAt: string;
}

// LRU Cache for memory management
class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize: number = MAX_MEMORY_CACHE) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global caches with memory limits
const mediaCache = new LRUCache<string>(30);
const metadataCache = new LRUCache<StorageMetadata>(100);

let dbInstance: IDBDatabase | null = null;
let persistentStorageGranted = false;

// Request persistent storage for unlimited quota
export const requestUnlimitedStorage = async (): Promise<boolean> => {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        persistentStorageGranted = await navigator.storage.persist();
      } else {
        persistentStorageGranted = true;
      }
    }
  } catch (e) {
    console.warn('Persistent storage request failed:', e);
  }
  return persistentStorageGranted;
};

// Initialize on module load
requestUnlimitedStorage();

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for chunked data
      if (!db.objectStoreNames.contains('chunks')) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunkStore.createIndex('parentId', 'parentId', { unique: false });
      }

      // Store for metadata
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'id' });
      }

      // Store for batch operations queue
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
  });
};

// Split large data into chunks for efficient storage
const splitIntoChunks = (data: string): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
};

// Store large data in chunks
export const storeLargeMedia = async (
  id: string,
  data: string,
  type: 'image' | 'audio' | 'file' = 'image',
  mimeType?: string
): Promise<boolean> => {
  try {
    const db = await openDB();
    const chunks = splitIntoChunks(data);
    
    const metadata: StorageMetadata = {
      id,
      type,
      totalSize: data.length,
      chunkCount: chunks.length,
      mimeType,
      createdAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chunks', 'metadata'], 'readwrite');
      const chunkStore = transaction.objectStore('chunks');
      const metaStore = transaction.objectStore('metadata');

      // Delete existing chunks for this id first
      const deleteIndex = chunkStore.index('parentId');
      const deleteRequest = deleteIndex.openCursor(IDBKeyRange.only(id));
      
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Store metadata
      metaStore.put(metadata);
      metadataCache.set(id, metadata);

      // Store chunks
      chunks.forEach((chunk, index) => {
        const chunkRecord: StorageChunk = {
          id: `${id}_chunk_${index}`,
          parentId: id,
          chunkIndex: index,
          totalChunks: chunks.length,
          data: chunk,
          createdAt: new Date().toISOString(),
        };
        chunkStore.put(chunkRecord);
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.error('Failed to store large media:', e);
    return false;
  }
};

// Retrieve large data by reassembling chunks
export const retrieveLargeMedia = async (id: string): Promise<string | null> => {
  // Check memory cache first
  const cached = mediaCache.get(id);
  if (cached) return cached;

  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chunks', 'metadata'], 'readonly');
      const chunkStore = transaction.objectStore('chunks');
      const metaStore = transaction.objectStore('metadata');

      // Get metadata first
      const metaRequest = metaStore.get(id);
      
      metaRequest.onsuccess = () => {
        const metadata = metaRequest.result as StorageMetadata | undefined;
        if (!metadata) {
          resolve(null);
          return;
        }

        // Get all chunks
        const chunkIndex = chunkStore.index('parentId');
        const chunkRequest = chunkIndex.getAll(IDBKeyRange.only(id));

        chunkRequest.onsuccess = () => {
          const chunks = chunkRequest.result as StorageChunk[];
          if (chunks.length === 0) {
            resolve(null);
            return;
          }

          // Sort by chunk index and reassemble
          chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
          const fullData = chunks.map(c => c.data).join('');

          // Cache in memory (LRU will evict old items if needed)
          mediaCache.set(id, fullData);
          metadataCache.set(id, metadata);

          resolve(fullData);
        };

        chunkRequest.onerror = () => reject(chunkRequest.error);
      };

      metaRequest.onerror = () => reject(metaRequest.error);
    });
  } catch (e) {
    console.error('Failed to retrieve large media:', e);
    return null;
  }
};

// Delete media and its chunks
export const deleteLargeMedia = async (id: string): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chunks', 'metadata'], 'readwrite');
      const chunkStore = transaction.objectStore('chunks');
      const metaStore = transaction.objectStore('metadata');

      // Delete metadata
      metaStore.delete(id);
      metadataCache.delete(id);
      mediaCache.delete(id);

      // Delete all chunks
      const index = chunkStore.index('parentId');
      const request = index.openCursor(IDBKeyRange.only(id));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.error('Failed to delete large media:', e);
    return false;
  }
};

// Get storage statistics
export const getStorageStats = async (): Promise<{
  used: number;
  available: number;
  persistent: boolean;
  itemCount: number;
}> => {
  let estimate = { usage: 0, quota: Infinity };
  
  try {
    if (navigator.storage?.estimate) {
      estimate = await navigator.storage.estimate() as { usage: number; quota: number };
    }
  } catch (e) {
    console.warn('Storage estimate failed:', e);
  }

  // Count items in database
  let itemCount = 0;
  try {
    const db = await openDB();
    const transaction = db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');
    const countRequest = store.count();
    
    itemCount = await new Promise<number>((resolve) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => resolve(0);
    });
  } catch (e) {
    console.warn('Failed to count items:', e);
  }

  return {
    used: estimate.usage || 0,
    available: persistentStorageGranted ? Infinity : (estimate.quota || 0),
    persistent: persistentStorageGranted,
    itemCount,
  };
};

// Batch save operations with queuing
let batchQueue: Array<{ id: string; data: string; type: 'image' | 'audio' | 'file' }> = [];
let batchTimeout: NodeJS.Timeout | null = null;

export const queueMediaSave = (
  id: string,
  data: string,
  type: 'image' | 'audio' | 'file' = 'image'
): void => {
  batchQueue.push({ id, data, type });
  
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }
  
  // Process queue after 200ms of inactivity
  batchTimeout = setTimeout(async () => {
    const toProcess = [...batchQueue];
    batchQueue = [];
    
    for (const item of toProcess) {
      await storeLargeMedia(item.id, item.data, item.type);
    }
  }, 200);
};

// Clear all caches (call when memory is low)
export const clearMemoryCaches = (): void => {
  mediaCache.clear();
  metadataCache.clear();
  console.log('Memory caches cleared');
};

// Check if storage is healthy
export const isStorageHealthy = async (): Promise<boolean> => {
  try {
    const stats = await getStorageStats();
    
    // If persistent storage is granted, always healthy
    if (stats.persistent) return true;
    
    // Check if more than 90% of quota is used
    if (stats.available > 0 && stats.used / stats.available > 0.9) {
      console.warn('Storage usage is over 90%');
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Storage health check failed:', e);
    return false;
  }
};

// Export cache utilities
export { LRUCache };
