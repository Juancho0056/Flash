// src/lib/services/studySuggestionService.ts

import { getAllSM2DataForUser, type SM2Data } from './sm2Service';

export interface SuggestedCard {
    flashcardId: string;
    collectionId: string; // Now available from SM2Data
    dueDate: number;      // Timestamp of when the card was due
    sm2Parameters: SM2Data; // Full SM-2 data for context
}

/**
 * Gets a list of flashcards that are due for review based on SM-2 scheduling.
 * @param userId The ID of the user for whom to fetch suggestions.
 * @param limit The maximum number of suggestions to return. Defaults to 20.
 * @returns An array of SuggestedCard objects, sorted by due date (oldest first).
 */
export function getDueCards(userId?: string, limit: number = 20): SuggestedCard[] {
    const allUserSM2Data = getAllSM2DataForUser(userId);
    const now = Date.now();

    const dueCards: SuggestedCard[] = allUserSM2Data
        .filter(item => item.data.dueDate <= now && item.data.collectionId) // Ensure dueDate is past and collectionId exists
        .map(item => ({
            flashcardId: item.flashcardId,
            collectionId: item.data.collectionId, // collectionId is part of SM2Data now
            dueDate: item.data.dueDate,
            sm2Parameters: item.data,
        }))
        .sort((a, b) => a.dueDate - b.dueDate); // Sort by due date, oldest first

    return dueCards.slice(0, limit);
}

// Potential future enhancements:
// - Function to get difficult cards explicitly.
// - Logic to mix new cards with due cards.
// - More complex prioritization (e.g., based on EF, number of lapses).
