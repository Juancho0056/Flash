// src/lib/services/progressService.ts

import type { StudyStats } from "$lib/stores/studyStats";

export interface StudyProgress {
  collectionId: string;
  currentIndex: number;
  correctAnswers: number;
  incorrectAnswers: number;
  currentScore: number;
  sessionCompleted: boolean;
  flashcardsState: Array<{ id: string; failedInSession?: boolean; answeredInSession?: boolean }>;
  // lastReviewedIndex: number; // Removed as it's redundant with currentIndex
  lastReviewedTimestamp: number;
  lastSavedTimestamp: number;
  sessionStartTime: number;
  studyStats: StudyStats;
}

const BASE_STORAGE_KEY_PREFIX = 'studyProgress_';

function getProgressStorageKey(collectionId: string, userId?: string): string {
  if (userId) {
    return `${BASE_STORAGE_KEY_PREFIX}${collectionId}_${userId}`;
  }
  return `${BASE_STORAGE_KEY_PREFIX}${collectionId}`; // Fallback for guest or shared progress
}

export function saveStudyProgress(progress: StudyProgress, userId?: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return; // SSR guard

  try {
    const key = getProgressStorageKey(progress.collectionId, userId);
    const progressJson = JSON.stringify(progress);
    localStorage.setItem(key, progressJson);
    // console.log(`Progress saved to key ${key} for collection ${progress.collectionId}, user ${userId || 'guest'}`);
  } catch (e) {
    console.error('Error saving study progress to localStorage:', e);
  }
}

export function loadStudyProgress(collectionId: string, userId?: string): StudyProgress | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null; // SSR guard

  try {
    const key = getProgressStorageKey(collectionId, userId);
    const progressJson = localStorage.getItem(key);
    if (progressJson) {
      const progress: StudyProgress = JSON.parse(progressJson);
      // console.log(`Progress loaded from key ${key} for collection ${collectionId}, user ${userId || 'guest'}:`, progress);
      return progress;
    }
  } catch (e) {
    console.error(`Error loading study progress from localStorage for key ${getProgressStorageKey(collectionId, userId)}:`, e);
    // Optionally clear corrupted data
    // localStorage.removeItem(getProgressStorageKey(collectionId, userId));
  }
  return null;
}

export function clearStudyProgress(collectionId: string, userId?: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return; // SSR guard

  try {
    const key = getProgressStorageKey(collectionId, userId);
    localStorage.removeItem(key);
    // console.log(`Progress cleared for key ${key}, collection ${collectionId}, user ${userId || 'guest'}`);
  } catch (e) {
    console.error('Error clearing study progress from localStorage:', e);
  }
}
