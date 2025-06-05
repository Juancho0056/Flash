// src/lib/services/studySuggestionService.ts

import { getAllUserFlashcardSM2Records, type UserFlashcardSM2Record } from './sm2Service';

export interface SuggestedCard {
    flashcardId: string;
    collectionId: string; // Corresponds to UserFlashcardSM2Record.originalCollectionId
    dueDate: number;      // JS Timestamp, converted from ISO string
    sm2Parameters: UserFlashcardSM2Record; // Store the whole record for context
}

/**
 * Gets a list of flashcards that are due for review based on SM-2 scheduling.
 * Assumes userId is inferred by the API called by sm2Service.
 * @param limit The maximum number of suggestions to return. Defaults to 20.
 * @returns An array of SuggestedCard objects, sorted by due date (oldest first).
 */
export async function getDueCards(limit: number = 20): Promise<SuggestedCard[]> {
    // userId is no longer passed to getAllUserFlashcardSM2Records as the service infers the user.
    const allUserSM2Records: UserFlashcardSM2Record[] = await getAllUserFlashcardSM2Records();
    const now = Date.now();

    const dueCards: SuggestedCard[] = allUserSM2Records
        .filter(item => {
            const itemDueDate = new Date(item.dueDate).getTime();
            return itemDueDate <= now && item.originalCollectionId; // Ensure dueDate is past and originalCollectionId exists
        })
        .map(item => ({
            flashcardId: item.flashcardId,
            collectionId: item.originalCollectionId, // Use correct field from UserFlashcardSM2Record
            dueDate: new Date(item.dueDate).getTime(),    // Convert ISO string to number (JS Timestamp)
            sm2Parameters: item,                         // item is a UserFlashcardSM2Record
        }))
        .sort((a, b) => a.dueDate - b.dueDate); // Sort by due date (JS Timestamp), oldest first

    return dueCards.slice(0, limit);
}

// Potential future enhancements:
// - Function to get difficult cards explicitly.
// - Logic to mix new cards with due cards.
// - More complex prioritization (e.g., based on EF, number of lapses).
