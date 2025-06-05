// src/lib/services/progressService.ts

export interface StudyProgress {
  collectionId: string;
  currentIndex: number;
  correctAnswers: number;
  incorrectAnswers: number;
  currentScore: number;
  sessionCompleted: boolean;
  flashcardsState: Array<{ id: string; failedInSession?: boolean; answeredInSession?: boolean }>;
  lastReviewedIndex: number;
  lastReviewedTimestamp: number;
  lastSavedTimestamp: number;
}

function getStorageKey(collectionId: string): string {
  return `studyProgress_${collectionId}`;
}

// (Continuing in src/lib/services/progressService.ts)
export function saveStudyProgress(progress: StudyProgress): void {
  if (typeof window === 'undefined') return; // SSR guard

  try {
    const key = getStorageKey(progress.collectionId);
    const progressJson = JSON.stringify(progress);
    localStorage.setItem(key, progressJson);
    // console.log(`Progress saved for collection ${progress.collectionId}`);
  } catch (e) {
    console.error('Error saving study progress to localStorage:', e);
  }
}

// (Continuing in src/lib/services/progressService.ts)
export function loadStudyProgress(collectionId: string): StudyProgress | null {
  if (typeof window === 'undefined') return null; // SSR guard

  try {
    const key = getStorageKey(collectionId);
    const progressJson = localStorage.getItem(key);
    if (progressJson) {
      const progress: StudyProgress = JSON.parse(progressJson);
      // Optional: Add data validation or migration logic here if structure changes
      // console.log(`Progress loaded for collection ${collectionId}:`, progress);
      return progress;
    }
  } catch (e) {
    console.error('Error loading study progress from localStorage:', e);
    // Optionally clear corrupted data
    // localStorage.removeItem(getStorageKey(collectionId));
  }
  return null;
}

// (Continuing in src/lib/services/progressService.ts)
export function clearStudyProgress(collectionId: string): void {
  if (typeof window === 'undefined') return; // SSR guard

  try {
    const key = getStorageKey(collectionId);
    localStorage.removeItem(key);
    // console.log(`Progress cleared for collection ${collectionId}`);
  } catch (e) {
    console.error('Error clearing study progress from localStorage:', e);
  }
}
