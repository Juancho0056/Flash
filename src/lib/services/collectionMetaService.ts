// src/lib/services/collectionMetaService.ts

const METADATA_STORAGE_KEY = 'collection_metadata_timestamps';

interface CollectionTimestamps {
  [collectionId: string]: number; // Stores lastStudiedTimestamp
}

function loadAllTimestamps(): CollectionTimestamps {
  if (typeof window === 'undefined') return {}; // SSR Guard
  const storedData = localStorage.getItem(METADATA_STORAGE_KEY);
  if (storedData) {
    try {
      return JSON.parse(storedData) as CollectionTimestamps;
    } catch (e) {
      console.error('Error parsing collection metadata from localStorage:', e);
      localStorage.removeItem(METADATA_STORAGE_KEY); // Clear corrupted data
      return {};
    }
  }
  return {};
}
export function wasCollectionCompleted(collectionId: string): boolean {
	const raw = localStorage.getItem(`${METADATA_STORAGE_KEY}${collectionId}:sessionCompleted`);
	return raw === 'true';
}
function saveAllTimestamps(timestamps: CollectionTimestamps): void {
  if (typeof window === 'undefined') return; // SSR Guard
  try {
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(timestamps));
  } catch (e) {
    console.error('Error saving collection metadata to localStorage:', e);
  }
}

export function updateLastStudiedTimestamp(collectionId: string, timestamp: number = Date.now()): void {
  const allTimestamps = loadAllTimestamps();
  allTimestamps[collectionId] = timestamp;
  saveAllTimestamps(allTimestamps);
  // console.log(`Updated lastStudiedTimestamp for ${collectionId} to ${new Date(timestamp).toLocaleString()}`);
}

export function getLastStudiedTimestamp(collectionId: string): number | null {
  const allTimestamps = loadAllTimestamps();
  return allTimestamps[collectionId] || null;
}

// Optional: Function to get all data at once if needed for a list view
export function getAllLastStudiedTimestamps(): CollectionTimestamps {
  return loadAllTimestamps();
}

// Optional: Clear function for testing or specific needs
export function clearLastStudiedTimestamp(collectionId: string): void {
  const allTimestamps = loadAllTimestamps();
  if (allTimestamps[collectionId]) {
    delete allTimestamps[collectionId];
    saveAllTimestamps(allTimestamps);
  }
}

export function clearAllMetadata_TESTONLY(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(METADATA_STORAGE_KEY);
  console.log('All collection metadata cleared for testing.');
}
