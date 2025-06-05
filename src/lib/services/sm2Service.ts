// src/lib/services/sm2Service.ts

/**
 * Represents the SM-2 data structure for a flashcard associated with a user,
 * as returned by the API. Aligns with the UserFlashcardSM2 Prisma model.
 */
export interface UserFlashcardSM2Record {
    id: string;                     // Server-generated ID
    userId: string;                 // Server-assigned or validated user ID
    flashcardId: string;
    easinessFactor: number;
    repetitions: number;
    intervalDays: number;           // Interval in days
    dueDate: string;                // ISO DateTime string from server
    lastReviewed: string;           // ISO DateTime string from server
    originalCollectionId: string;   // Denormalized from Flashcard's collection
    collectionName?: string;        // Denormalized from Flashcard's collection
    createdAt: string;              // ISO DateTime string
    updatedAt: string;              // ISO DateTime string
}

/**
 * Payload for updating SM-2 data via the API.
 */
export interface UpdateSM2Payload {
    flashcardId: string;
    collectionId: string;         // originalCollectionId for the SM-2 record
    collectionName?: string;
    quality: number;              // User's recall quality (0-5)
}

/**
 * Fetches a specific SM-2 record for a flashcard.
 * Assumes userId is inferred by the server from the session.
 * @param flashcardId The ID of the flashcard.
 * @returns The SM-2 record or null if not found or an error occurs.
 */
export async function getUserFlashcardSM2Record(flashcardId: string): Promise<UserFlashcardSM2Record | null> {
    if (typeof window === 'undefined') {
        console.warn('getUserFlashcardSM2Record called in non-browser context.');
        return null;
    }
    try {
        const response = await fetch(`/api/user-flashcard-sm2?flashcardId=${flashcardId}`);
        if (response.status === 404) {
            // console.log(`No SM2 data found on server for flashcard ${flashcardId}.`);
            return null; // Common case: no SM-2 data saved yet for this card
        }
        if (!response.ok) {
            console.error(`Failed to get SM2 data for card ${flashcardId}:`, response.status, await response.text());
            return null;
        }
        return await response.json() as UserFlashcardSM2Record;
    } catch (error) {
        console.error(`Error getting SM2 data for card ${flashcardId}:`, error);
        return null;
    }
}

/**
 * Updates SM-2 data for a flashcard by sending recall quality to the server.
 * The server will perform SM-2 calculations and persist the new data.
 * Assumes userId is inferred by the server from the session.
 * @param payload The data needed to update SM-2 stats, including flashcardId, collection context, and quality.
 * @returns The updated SM-2 record from the server or null if an error occurs.
 */
export async function updateSM2Data(payload: UpdateSM2Payload): Promise<UserFlashcardSM2Record | null> {
    if (typeof window === 'undefined') {
        console.warn('updateSM2Data called in non-browser context.');
        return null;
    }
    try {
        const response = await fetch('/api/user-flashcard-sm2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            console.error('Failed to update SM2 data for card:', payload.flashcardId, response.status, await response.text());
            return null;
        }
        return await response.json() as UserFlashcardSM2Record;
    } catch (error) {
        console.error('Error updating SM2 data for card:', payload.flashcardId, error);
        return null;
    }
}

/**
 * Fetches all SM-2 records for the current user from the server.
 * Assumes userId is inferred by the server from the session.
 * @returns An array of SM-2 records.
 */
export async function getAllUserFlashcardSM2Records(): Promise<UserFlashcardSM2Record[]> {
    if (typeof window === 'undefined') {
        console.warn('getAllUserFlashcardSM2Records called in non-browser context.');
        return [];
    }
    try {
        const response = await fetch('/api/user-flashcard-sm2/all');
        if (!response.ok) {
            console.error('Failed to get all SM2 records for user:', response.status, await response.text());
            return [];
        }
        return await response.json() as UserFlashcardSM2Record[];
    } catch (error) {
        console.error('Error getting all SM2 records for user:', error);
        return [];
    }
}

/**
 * Clears the SM-2 record for a specific flashcard for the current user on the server.
 * Assumes userId is inferred by the server from the session.
 * @param flashcardId The ID of the flashcard whose SM-2 record should be cleared.
 * @returns True if successful, false otherwise.
 */
export async function clearUserFlashcardSM2Record(flashcardId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
        console.warn('clearUserFlashcardSM2Record called in non-browser context.');
        return false;
    }
    try {
        const response = await fetch(`/api/user-flashcard-sm2?flashcardId=${flashcardId}`, { method: 'DELETE' });
        if (!response.ok) {
            console.error(`Failed to clear SM2 record for card ${flashcardId}:`, response.status, await response.text());
            return false;
        }
        // console.log(`SM2 record for card ${flashcardId} cleared successfully.`);
        return true;
    } catch (error) {
        console.error('Error clearing SM2 record:', error);
        return false;
    }
}

/**
 * Clears ALL SM-2 records for the current user on the server (FOR TESTING/DEVELOPMENT).
 * Assumes userId is inferred by the server from the session.
 * USE WITH CAUTION.
 * @returns True if successful, false otherwise.
 */
export async function clearAllUserFlashcardSM2Records_TESTONLY(): Promise<boolean> {
    if (typeof window === 'undefined') {
        console.warn('clearAllUserFlashcardSM2Records_TESTONLY called in non-browser context.');
        return false;
    }
    try {
        const response = await fetch('/api/user-flashcard-sm2/all', { method: 'DELETE' });
        if (!response.ok) {
            console.error('Failed to clear all SM2 records for user:', response.status, await response.text());
            return false;
        }
        // console.log('All SM2 records for current user cleared successfully.');
        return true;
    } catch (error) {
        console.error('Error clearing all SM2 records for user:', error);
        return false;
    }
}
