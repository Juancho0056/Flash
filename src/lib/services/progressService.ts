// src/lib/services/progressService.ts

import type { StudyStats } from '$lib/stores/studyStats';

// Data payload sent to the server for saving progress
export interface UserProgressPayload {
  collectionId: string; // This will be mapped to originalCollectionId by the API
  currentIndex: number;
  correctAnswers: number;
  incorrectAnswers: number;
  currentScore: number;
  sessionCompleted: boolean;
  flashcardsState: Array<{ id: string; failedInSession?: boolean; answeredInSession?: boolean }>;
  sessionStartTime: number; // JS Timestamp (milliseconds since epoch)
  studyStats: StudyStats;
  // lastReviewedTimestamp is effectively replaced by lastSavedTimestamp on the server
  // lastSavedTimestamp is also managed by the server (e.g., @updatedAt)
}

// Data structure received from the server (matches Prisma model UserStudyProgress + potential relations)
export interface UserStudyProgressRecord extends UserProgressPayload {
  id: string;                 // Server-generated ID
  userId: string;             // Server-assigned or validated user ID
  lastSavedTimestamp: string; // ISO DateTime string from server (represents last update time)
  createdAt: string;          // ISO DateTime string
  updatedAt: string;          // ISO DateTime string
  // Note: sessionStartTime will be a string if it's a DateTime in Prisma, needs conversion
}

/**
 * Saves study progress to the server.
 * Assumes userId is handled by the server via session/authentication context.
 * @param progress The study progress data to save.
 * @returns True if successful, false otherwise.
 */
export async function saveStudyProgress(progress: UserProgressPayload): Promise<boolean> {
    if (typeof window === 'undefined') { // Should not be called in SSR context directly
        console.warn('saveStudyProgress called in non-browser context.');
        return false;
    }

    try {
        const response = await fetch('/api/user-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(progress),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to save study progress to server:', response.status, errorBody);
            return false;
        }
        // console.log('Study progress saved successfully.');
        return true;
    } catch (error) {
        console.error('Error saving study progress to server:', error);
        return false;
    }
}

/**
 * Loads study progress for a specific collection from the server.
 * Assumes userId is handled by the server via session/authentication context.
 * @param collectionId The ID of the collection for which to load progress.
 * @returns The study progress record, or null if not found or an error occurs.
 */
export async function loadStudyProgress(collectionId: string): Promise<UserStudyProgressRecord | null> {
    if (typeof window === 'undefined') {
        console.warn('loadStudyProgress called in non-browser context.');
        return null;
    }

    try {
        const response = await fetch(`/api/user-progress?originalCollectionId=${collectionId}`);

        if (response.status === 404) {
            // console.log(`No study progress found on server for collection ${collectionId}.`);
            return null; // Common case: no progress saved yet
        }
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to load study progress from server:', response.status, errorBody);
            return null;
        }

        const record: UserStudyProgressRecord = await response.json();

        // Ensure sessionStartTime is a number (JS timestamp)
        // Prisma DateTime fields are often serialized as ISO strings
        if (record && typeof record.sessionStartTime === 'string') {
            record.sessionStartTime = new Date(record.sessionStartTime).getTime();
        }

        // console.log(`Study progress loaded for collection ${collectionId}:`, record);
        return record;
    } catch (error) {
        console.error('Error loading study progress from server:', error);
        return null;
    }
}

/**
 * Clears study progress for a specific collection on the server.
 * Assumes userId is handled by the server via session/authentication context.
 * @param collectionId The ID of the collection for which to clear progress.
 * @returns True if successful, false otherwise.
 */
export async function clearStudyProgress(collectionId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
        console.warn('clearStudyProgress called in non-browser context.');
        return false;
    }

    try {
        const response = await fetch(`/api/user-progress?originalCollectionId=${collectionId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to clear study progress on server:', response.status, errorBody);
            return false;
        }
        // console.log(`Study progress cleared for collection ${collectionId} on server.`);
        return true;
    } catch (error) {
        console.error('Error clearing study progress on server:', error);
        return false;
    }
}
