// src/lib/services/studyHistoryService.ts
import {prisma} from '$lib/db';

// Data payload for saving a session (client-side structure before sending to API)
export interface StudySessionData {
    originalCollectionId: string;
    collectionName: string;
    sessionStartTime: number;   // JS timestamp (ms)
    sessionEndTime: number;     // JS timestamp (ms)
    durationMs: number;
    cardsInView: number;        // Number of cards in the specific segment studied
    originalCollectionSize?: number;
    cardsAttempted?: number;     // Number of cards actually answered/interacted with
    correct: number;
    incorrect: number;
    score: number;
    streak: number;             // Final streak of the session segment
    longestStreak: number;      // Longest streak achieved in this segment
    sessionType: string;        // e.g., "FULL", "REVIEW" (matches SessionType enum on server)
    status: string;             // e.g., "COMPLETED", "ABANDONED" (matches SessionStatus enum on server)
}

// Structure of a history record as returned by the API (includes server-generated fields)
export interface StudySessionHistoryRecord extends StudySessionData {
    id: string;                 // Server-generated ID
    userId: string;             // Server-assigned or validated user ID
    createdAt: string;          // ISO DateTime string from server
    updatedAt: string;          // ISO DateTime string from server
}

/**
 * Saves a study session to the server.
 * Assumes userId is handled by the server via session/authentication context.
 * @param session The study session data to save.
 * @returns True if successful, false otherwise.
 */
export async function saveSessionToHistory(session: StudySessionData): Promise<boolean> {
    if (typeof window === 'undefined') { // SSR Guard or if window context isn't available
        console.warn('Fetch API not available. Cannot save session to history.');
        return false;
    }
    try {
        const response = await fetch('/api/study-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(session),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to save study session to server:', response.status, errorBody);
            return false;
        }
        // const savedRecord = await response.json(); // Optional: if API returns the created record
        // console.log('Session saved to server:', savedRecord);
        return true;
    } catch (error) {
        console.error('Error saving study session to server:', error);
        return false;
    }
}

/**
 * Fetches the study history for a user from the server.
 * @param userId Optional: ID of the user. If not provided, API might infer from session.
 * @returns An array of study session history records.
 */
export async function getStudyHistory(userId?: string): Promise<StudySessionHistoryRecord[]> {
    if (typeof window === 'undefined') return []; // SSR Guard

    try {
        // API might infer userId from session if not provided as a query param.
        // Including it here for flexibility or potential admin use cases.
        const url = userId ? `/api/study-history?userId=${userId}` : '/api/study-history';

        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch study history from server:', response.status, await response.text());
            return [];
        }
        return await response.json() as StudySessionHistoryRecord[];
    } catch (error) {
        console.error('Error fetching study history from server:', error);
        return [];
    }
}

/**
 * Calculates the total score for a user by summing the maximum scores
 * achieved in each unique collection they have studied.
 * This function is intended for server-side use.
 * @param userId The ID of the user.
 * @returns The total calculated score, or 0 in case of an error or no scores.
 */
export async function calculateUserTotalScore(userId: string): Promise<number> {
    try {
        const groupedScores = await prisma.studySessionRecord.groupBy({
            by: ['originalCollectionId'],
            where: {
                userId: userId,
            },
            _max: {
                score: true,
            },
        });

        if (!groupedScores || groupedScores.length === 0) {
            return 0;
        }

        let totalScore = 0;
        for (const group of groupedScores) {
            totalScore += group._max.score || 0; // Add score, treating null as 0
        }

        return totalScore;
    } catch (error) {
        console.error(`Error calculating total score for user ${userId}:`, error);
        return 0; // Return 0 in case of any error
    }
}

/**
 * Fetches study history for a specific collection and optionally a user.
 * @param originalCollectionId The ID of the collection.
 * @param userId Optional: ID of the user. API might infer from session if not provided.
 * @returns An array of study session history records for the collection.
 */
export async function getStudyHistoryByCollection(originalCollectionId: string, userId?: string): Promise<StudySessionHistoryRecord[]> {
    if (typeof window === 'undefined') return []; // SSR Guard

    try {
        let url = `/api/study-history?originalCollectionId=${originalCollectionId}`;
        if (userId) {
            url += `&userId=${userId}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch collection study history from server:', response.status, await response.text());
            return [];
        }
        return await response.json() as StudySessionHistoryRecord[];
    } catch (error) {
        console.error('Error fetching collection study history from server:', error);
        return [];
    }
}
