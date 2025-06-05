// src/lib/services/collectionMetaService.ts

const BASE_METADATA_STORAGE_KEY = 'collection_metadata_timestamps';

interface CollectionTimestamps {
  [collectionId: string]: number; // Stores lastStudiedTimestamp
}

function getMetadataStorageKey(userId?: string): string {
  return userId ? `${BASE_METADATA_STORAGE_KEY}_${userId}` : BASE_METADATA_STORAGE_KEY;
}

function loadAllTimestamps(userId?: string): CollectionTimestamps {
  if (typeof window === 'undefined') return {}; // SSR Guard
  const storageKey = getMetadataStorageKey(userId);
  const storedData = localStorage.getItem(storageKey);
  if (storedData) {
    try {
      return JSON.parse(storedData) as CollectionTimestamps;
    } catch (e) {
      console.error('Error parsing collection metadata from localStorage:', e);
      localStorage.removeItem(storageKey); // Clear corrupted data
      return {};
    }
  }
  return {};
}

export function wasCollectionCompleted(collectionId: string, userId?: string): boolean {
  if (typeof window === 'undefined') return false; // SSR Guard
  const keySuffix = userId ? `_${userId}` : '';
  // Note: This key structure is different from timestamps. Consider consolidating if appropriate.
  const raw = localStorage.getItem(`${BASE_METADATA_STORAGE_KEY}_${collectionId}_sessionCompleted${keySuffix}`);
  return raw === 'true';
}

function saveAllTimestamps(timestamps: CollectionTimestamps, userId?: string): void {
  if (typeof window === 'undefined') return; // SSR Guard
  const storageKey = getMetadataStorageKey(userId);
  try {
    localStorage.setItem(storageKey, JSON.stringify(timestamps));
  } catch (e) {
    console.error('Error saving collection metadata to localStorage:', e);
  }
}

export function updateLastStudiedTimestamp(collectionId: string, timestamp: number = Date.now(), userId?: string): void {
  const allTimestamps = loadAllTimestamps(userId);
  allTimestamps[collectionId] = timestamp;
  saveAllTimestamps(allTimestamps, userId);
  // console.log(`Updated lastStudiedTimestamp for ${collectionId} to ${new Date(timestamp).toLocaleString()}`);
}

export function getLastStudiedTimestamp(collectionId: string, userId?: string): number | null {
  const allTimestamps = loadAllTimestamps(userId);
  return allTimestamps[collectionId] || null;
}

// Optional: Function to get all data at once if needed for a list view
export function getAllLastStudiedTimestamps(userId?: string): CollectionTimestamps {
  return loadAllTimestamps(userId);
}

// Optional: Clear function for testing or specific needs
export function clearLastStudiedTimestamp(collectionId: string, userId?: string): void {
  const allTimestamps = loadAllTimestamps(userId);
  if (allTimestamps[collectionId]) {
    delete allTimestamps[collectionId];
    saveAllTimestamps(allTimestamps, userId);
  }
}

export function clearAllMetadata_TESTONLY(userId?: string): void { // Added optional userId
  if (typeof window === 'undefined') return;
  // If userId is provided, it clears user-specific data. Otherwise, clears guest data.
  localStorage.removeItem(getMetadataStorageKey(userId));
  console.log(`All collection metadata cleared for ${userId || 'guest'}.`);
}
