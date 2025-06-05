// src/lib/services/sm2Service.ts

export interface SM2Data {
    easinessFactor: number;
    repetitions: number;
    interval: number; // in days
    dueDate: number; // timestamp for next review
    lastReviewed: number; // timestamp of the last review
}

const BASE_SM2_STORAGE_KEY = 'sm2Progress';
const DEFAULT_EF = 2.5;

function getSM2StorageKey(flashcardId: string, userId?: string): string {
    return userId ? `${BASE_SM2_STORAGE_KEY}_${userId}_${flashcardId}` : `${BASE_SM2_STORAGE_KEY}_guest_${flashcardId}`;
}

export function getSM2Data(flashcardId: string, userId?: string): SM2Data | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;

    const key = getSM2StorageKey(flashcardId, userId);
    const jsonData = localStorage.getItem(key);
    if (jsonData) {
        try {
            return JSON.parse(jsonData) as SM2Data;
        } catch (e) {
            console.error(`Error parsing SM2 data for key ${key}:`, e);
            localStorage.removeItem(key); // Clear corrupted data
            return null;
        }
    }
    return null;
}

function saveSM2Data(flashcardId: string, data: SM2Data, userId?: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const key = getSM2StorageKey(flashcardId, userId);
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error saving SM2 data for key ${key}:`, e);
    }
}

/**
 * Calculates new SM-2 parameters.
 * @param currentData The current SM2Data. If null or for a new card, default values are used.
 * @param quality The quality of response (0-5).
 *                     5: Perfect response
 *                     4: Correct response after some hesitation
 *                     3: Correct response with difficulty
 *                     2: Incorrect response; where the correct one seemed easy to recall
 *                     1: Incorrect response; the correct answer given comes to mind
 *                     0: Complete blackout.
 * @returns The new SM2Data.
 */
export function calculateSM2Params(currentData: SM2Data | null, quality: number): SM2Data {
    let { easinessFactor, repetitions, interval } = currentData || {
        easinessFactor: DEFAULT_EF,
        repetitions: 0,
        interval: 0, // Will be set to 1 on first correct repetition
    };

    if (quality < 0 || quality > 5) {
        throw new Error('Quality must be between 0 and 5.');
    }

    // 1. Update Easiness Factor
    easinessFactor = Math.max(1.3, easinessFactor - 0.8 + 0.28 * quality - 0.02 * quality * quality);

    // 2. Update repetitions and interval
    if (quality < 3) { // Incorrect response
        repetitions = 0; // Reset repetitions
        interval = 1;    // Next review in 1 day
    } else { // Correct response
        repetitions += 1;
        if (repetitions === 1) {
            interval = 1;
        } else if (repetitions === 2) {
            interval = 6;
        } else {
            interval = Math.ceil(interval * easinessFactor);
        }
    }

    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const dueDate = now + interval * oneDayInMs;

    return {
        easinessFactor,
        repetitions,
        interval,
        dueDate,
        lastReviewed: now,
    };
}

/**
 * Updates SM-2 data for a flashcard based on recall quality.
 * Retrieves current data, calculates new params, and saves it.
 */
export function updateSM2Data(flashcardId: string, quality: number, userId?: string): SM2Data {
    const currentData = getSM2Data(flashcardId, userId);
    const newData = calculateSM2Params(currentData, quality);
    saveSM2Data(flashcardId, newData, userId);
    // console.log(`SM2 data updated for ${flashcardId} (user: ${userId || 'guest'}):`, newData);
    return newData;
}

/**
 * Gets all SM2 data for a user. Potentially slow, use with caution.
 * This is a simplified example and might not be efficient for many cards.
 */
export function getAllSM2DataForUser(userId?: string): Array<{flashcardId: string, data: SM2Data}> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];

    const results: Array<{flashcardId: string, data: SM2Data}> = [];
    const prefix = userId ? `${BASE_SM2_STORAGE_KEY}_${userId}_` : `${BASE_SM2_STORAGE_KEY}_guest_`;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            const flashcardId = key.substring(prefix.length);
            const data = getSM2Data(flashcardId, userId); // Use existing getter for parsing
            if (data) {
                results.push({ flashcardId, data });
            }
        }
    }
    return results;
}

/**
 * Clears SM2 data for a specific flashcard and user.
 */
export function clearSM2Data(flashcardId: string, userId?: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const key = getSM2StorageKey(flashcardId, userId);
    localStorage.removeItem(key);
}

/**
 * Clears ALL SM2 data for a specific user or guest.
 * USE WITH CAUTION.
 */
export function clearAllSM2DataForUser_TESTONLY(userId?: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const prefix = userId ? `${BASE_SM2_STORAGE_KEY}_${userId}_` : `${BASE_SM2_STORAGE_KEY}_guest_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared all SM2 data for user: ${userId || 'guest'} (prefix: ${prefix})`);
}
