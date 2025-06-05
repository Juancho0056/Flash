import { studyStats } from '$lib/stores/studyStats';
import { writable, derived, get } from 'svelte/store';
import { page } from '$app/stores';
import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
import { awardBadge, BadgeId } from '$lib/services/badgeService'; // Import BadgeId and awardBadge
import { globalUserStats, incrementTotalCorrectAnswersAllTime } from '$lib/stores/globalUserStats'; // Import global stats
import { loadStudyProgress, saveStudyProgress } from '$lib/services/progressService';
import { updateLastStudiedTimestamp } from '$lib/services/collectionMetaService';
import { saveSessionToHistory } from '$lib/services/studyHistoryService';
import { clearStudyProgress } from '$lib/services/progressService';
import { updateSM2Data, getUserFlashcardSM2Record, type UpdateSM2Payload, type UserFlashcardSM2Record } from '$lib/services/sm2Service';

// Constants for automatic difficult card detection
const INCORRECT_THRESHOLD_SESSION = 3; // Times incorrect in current session to mark as difficult
const EF_DIFFICULTY_THRESHOLD = 1.8;   // SM-2 Easiness Factor threshold

export interface FlashcardStudy extends PrismaFlashcard {
  flipped?: boolean;
  failedInSession?: boolean;
  answeredInSession?: boolean; // ✅ NUEVO
  incorrectCountInSession?: number;
}

export interface CollectionWithFlashcards extends Collection {
  flashcards: FlashcardStudy[]; // Note: these are PrismaFlashcard, not FlashcardStudy initially
}

// State for the active study session
const initialStudyState = {
  flashcards: [] as FlashcardStudy[], // This will hold FlashcardStudy objects
  activeCollection: null as CollectionWithFlashcards | null, // Holds the original collection
  currentIndex: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  timerActive: false, // Example, can be expanded for session timing
  // showOnlyFailed: false, // Kept for potential direct use, though isFilteredViewActive is primary -> REMOVED
  isFilteredViewActive: false,
  isUnansweredOnly: false, // For filtering unanswered cards
  currentScore: 0,
  sessionCompleted: false, // New state
  isReviewMode: false, // For review mode toggle
};

// Writable stores
export const currentFlashcards = writable<FlashcardStudy[]>(initialStudyState.flashcards);
export const activeCollection = writable<CollectionWithFlashcards | null>(initialStudyState.activeCollection);
export const currentIndex = writable<number>(initialStudyState.currentIndex);
export const correctAnswers = writable<number>(initialStudyState.correctAnswers);
export const incorrectAnswers = writable<number>(initialStudyState.incorrectAnswers);
export const currentScore = writable<number>(initialStudyState.currentScore); // Score store
export const sessionCompleted = writable<boolean>(initialStudyState.sessionCompleted); // New store
export const timerActive = writable<boolean>(initialStudyState.timerActive);
// export const showOnlyFailed = writable<boolean>(initialStudyState.showOnlyFailed); // Legacy or specific use -> REMOVED
export const isFilteredViewActive = writable<boolean>(initialStudyState.isFilteredViewActive);
export const isUnansweredOnly = writable<boolean>(initialStudyState.isUnansweredOnly);
export const isReviewMode = writable<boolean>(initialStudyState.isReviewMode);
export const masterSessionCards = writable<FlashcardStudy[]>([]);
export const sessionStartTime = writable<number>(Date.now());
// Constants
const POINTS_PER_CORRECT_ANSWER = 10;
const BASE_REVIEW_MODE_STORAGE_KEY = 'reviewModeByCollection';

function getReviewModeStorageKey(userId?: string): string {
	return userId ? `${BASE_REVIEW_MODE_STORAGE_KEY}_${userId}` : BASE_REVIEW_MODE_STORAGE_KEY;
}
// Derived store for current card based on currentIndex and flashcards
export const currentCard = derived(
  [currentFlashcards, currentIndex],
  ([$currentFlashcards, $currentIndex]) => {
    if ($currentFlashcards && $currentFlashcards.length > $currentIndex) {
      return $currentFlashcards[$currentIndex];
    }
    return null;
  }
);

// Derived store for progress
export const progressPercentage = derived(
  [currentIndex, currentFlashcards],
  ([$currentIndex, $currentFlashcards]) => {
    if (!$currentFlashcards || $currentFlashcards.length === 0) {
      return 0;
    }
    // +1 because currentIndex is 0-based
    return (($currentIndex + 1) / $currentFlashcards.length) * 100;
  }
);

// Derived store for total flashcards
export const totalFlashcards = derived(currentFlashcards, ($currentFlashcards) => {
  return $currentFlashcards.length;
});

export function loadReviewModeFor(collectionId: string) {
	const userId = get(page).data.user?.id;
	const map = JSON.parse(sessionStorage.getItem(getReviewModeStorageKey(userId)) || '{}');
	const active = !!map[collectionId];
	console.log('active review', active);
	isReviewMode.set(active);
}

export function saveReviewModeFor(collectionId: string, value: boolean) {
	const userId = get(page).data.user?.id;
	const storageKey = getReviewModeStorageKey(userId);
	const map = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
	map[collectionId] = value;
	sessionStorage.setItem(storageKey, JSON.stringify(map));
	console.log('saveReviewModeFor', value);
	isReviewMode.set(value);
}
// Function to load a new collection for study
export async function loadCollectionForStudy(collectionData: CollectionWithFlashcards | null) {
  if (!collectionData || !collectionData.flashcards) {
    resetStudyState();
    return;
  }
  // userId is not passed to loadReviewModeFor as it gets it from page store internally.
  loadReviewModeFor(collectionData.id);
  // userId is no longer passed to loadStudyProgress as API infers user from session.
  const savedProgress = await loadStudyProgress(collectionData.id);
  const review = get(isReviewMode); // Check review mode status BEFORE loading progress

  activeCollection.set(collectionData);
  console.log(`Loading collection for study: ${collectionData.name} (${collectionData.id})`);
  console.log('Review mode:', review);
  console.log('Saved progress:', savedProgress);

  const savedFlashcardsState = new Map<string, { answeredInSession: boolean; failedInSession: boolean }>(
    savedProgress?.flashcardsState?.map(fs => [
      String(fs.id),
      {
        answeredInSession: fs.answeredInSession ?? false,
        failedInSession: fs.failedInSession ?? false
      }
    ]) ?? []
  );

  const initialFlashcards = collectionData.flashcards.map(fc => {
    const savedState = savedFlashcardsState.get(String(fc.id));
    return {
      ...fc,
      flipped: false,
      failedInSession: savedState?.failedInSession ?? false,
      answeredInSession: savedState?.answeredInSession ?? false,
      isDifficult: fc.isDifficult ?? false, // Keep existing isDifficult loading
      timesViewed: fc.timesViewed ?? 0,
      timesCorrect: fc.timesCorrect ?? 0,
      incorrectCountInSession: 0, // Initialize new counter
    };
  });

  // Restaurar stats si existen
  // Load initialFlashcards state (failedInSession, answeredInSession) REGARDLESS of review mode
  // as this reflects the actual learned state of cards.
  currentFlashcards.set(initialFlashcards);
  masterSessionCards.set(initialFlashcards);

  if (review) {
    // In Review Mode: Load mastery stats from savedProgress, reset session-specifics.
    if (savedProgress) {
      correctAnswers.set(savedProgress.correctAnswers);
      incorrectAnswers.set(savedProgress.incorrectAnswers);
      currentScore.set(savedProgress.currentScore);
      studyStats.set(savedProgress.studyStats); // These reflect mastery.
    } else {
      // Fallback if no savedProgress, though unlikely for a mastered session.
      correctAnswers.set(0);
      incorrectAnswers.set(0);
      currentScore.set(0);
      studyStats.set({
        totalViewed: 0, // Or consider loading from initialFlashcards if they reflect views
        totalCorrect: 0,
        totalIncorrect: 0,
        correctStreak: 0,
        longestStreak: 0,
        difficultAnswered: 0,
        badgesUnlocked: [] // Keep badges if they were part of savedProgress.studyStats
      });
    }
    currentIndex.set(0); // Start review from the beginning.
    sessionCompleted.set(true); // Session being reviewed was completed.
    sessionStartTime.set(Date.now()); // New start time for the review itself.
  } else {
    // Not in Review Mode: Load saved progress or set defaults.
    if (savedProgress) {
      currentIndex.set(savedProgress.currentIndex);
      correctAnswers.set(savedProgress.correctAnswers);
      incorrectAnswers.set(savedProgress.incorrectAnswers);
      currentScore.set(savedProgress.currentScore);
      sessionCompleted.set(savedProgress.sessionCompleted);
      studyStats.set(savedProgress.studyStats); // Restore session stats
      sessionStartTime.set(savedProgress.sessionStartTime || Date.now());
    } else {
      // No saved progress and not in review mode: Start fresh.
      currentIndex.set(0);
      correctAnswers.set(0);
      incorrectAnswers.set(0);
      currentScore.set(0);
      sessionCompleted.set(false);
      studyStats.set({ // Reset to initial study stats
        totalViewed: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        correctStreak: 0,
        longestStreak: 0,
        difficultAnswered: 0,
        badgesUnlocked: []
      });
      sessionStartTime.set(Date.now());
    }
  }

  // Common final setup
  timerActive.set(true);
  // showOnlyFailed.set(false); // REMOVED
  isFilteredViewActive.set(false);
  isUnansweredOnly.set(false); // Ensure this is reset too
  currentIndex.update(n => n);
}

// Function to update flip state of a card
export function flipCard(cardId: string, flippedState: boolean) {
    currentFlashcards.update(cards => {
        const cardIndex = cards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            cards[cardIndex].flipped = flippedState;
        }
        return cards;
    });
}


// Function to mark an answer
export async function markAnswer(isCorrect: boolean) {
	const current = get(currentCard);

	// ✅ Protección inmediata
	// If no current card, return.
	// If the session (current view) is completed, AND we are not in a filtered view,
	// AND the current card is NOT marked as failed (i.e., it's perfectly answered), THEN return.
	// Otherwise (e.g., session completed, but current card IS failed), proceed.
	if (!current || (get(sessionCompleted) && !get(isFilteredViewActive) && !current.failedInSession)) {
		return;
	}

  // Optional: This specific check can remain for logging or be removed if the main guard is considered sufficient.
  // It primarily prevents re-processing a card that is already correctly answered.
  console.log('Current card:', current);
  if (current.answeredInSession && !current.failedInSession) {
    console.warn('Card already answered, skipping.');
    return;
  }

	// 🟦 Actualizar currentFlashcards
	currentFlashcards.update(cards => {
		const idx = get(currentIndex);
		const card = cards[idx];
		if (!card || card.answeredInSession) return cards;

		const updated = [...cards];
		const cardBeingUpdated = cards[idx];
		let currentSessionIncorrects = cardBeingUpdated.incorrectCountInSession || 0;
		if (!isCorrect) {
			currentSessionIncorrects++;
		}
		updated[idx] = {
			...cardBeingUpdated,
			answeredInSession: true,
			failedInSession: !isCorrect,
			incorrectCountInSession: currentSessionIncorrects
		};
		return updated;
	});

	// 🟦 Actualizar masterSessionCards
	masterSessionCards.update(cards => {
		const idx = cards.findIndex(c => c.id === current.id);
		if (idx === -1 || cards[idx].answeredInSession) return cards;

		const updated = [...cards];
		const cardBeingUpdated = cards[idx];
		let currentSessionIncorrects = cardBeingUpdated.incorrectCountInSession || 0;
		if (!isCorrect) {
			currentSessionIncorrects++;
		}
		updated[idx] = {
			...cardBeingUpdated,
			answeredInSession: true,
			failedInSession: !isCorrect,
			incorrectCountInSession: currentSessionIncorrects
		};
		return updated;
	});

	// 📊 Actualizar estadísticas visuales
	studyStats.update(stats => {
		stats.totalViewed++;
		if (isCorrect) {
			stats.totalCorrect++;
			stats.correctStreak++;
			if (stats.correctStreak > stats.longestStreak) {
				stats.longestStreak = stats.correctStreak;
			}
		} else {
			stats.totalIncorrect++;
			stats.correctStreak = 0;
		}
		return stats; // Return the modified stats object
	});

	// 🧠 Actualizar contadores numéricos y otorgar insignias relacionadas
	if (isCorrect) {
		// current is from get(currentCard) - reflects state *before* this answer
		// Award points only if it's the first time correct OR correcting a failed card.
		const awardPointsForThisCard = !current.answeredInSession || current.failedInSession;

		if (awardPointsForThisCard) {
			currentScore.update(s => s + POINTS_PER_CORRECT_ANSWER);
		}
		correctAnswers.update(n => n + 1); // This counts any "correct" click.
		incrementTotalCorrectAnswersAllTime(); // Increment global all-time correct answers

		// Award badges based on updated stats
		const currentSessionCorrectAnswers = get(correctAnswers);
		const currentSessionStreak = get(studyStats).correctStreak;
		const allTimeCorrect = get(globalUserStats).totalCorrectAnswersAllTime;

		if (currentSessionCorrectAnswers === 10) { // This is total correct in session, not streak
			awardBadge(BadgeId.TEN_CORRECT_IN_SESSION);
		}
		if (currentSessionStreak === 5) {
			awardBadge(BadgeId.STREAK_5);
		}
		if (currentSessionStreak === 10) {
			awardBadge(BadgeId.STREAK_10);
		}
		if (allTimeCorrect === 50) {
			awardBadge(BadgeId.CORRECT_50);
		}

	} else {
		incorrectAnswers.update(n => n + 1);
	}

	// ✅ Validar final de sesión y otorgar insignias relacionadas
	const allAnswered = get(currentFlashcards).every(fc => fc.answeredInSession);
	if (get(currentFlashcards).length > 0 && allAnswered) {
		sessionCompleted.set(true); // Set session as completed
		awardBadge(BadgeId.FIRST_SESSION_COMPLETED); // Award first session completion badge

		// Check for collection mastery (only if this is a full, non-review session view)
		const isFullSessionView = !get(isFilteredViewActive) && !get(isReviewMode);
		// New condition: all cards in masterSessionCards must be answered and not failed.
		const allMasterCardsPerfectlyAnswered = get(masterSessionCards).every(
			(card) => card.answeredInSession && !card.failedInSession
		);

		if (isFullSessionView && allMasterCardsPerfectlyAnswered) {
			awardBadge(BadgeId.COLLECTION_MASTERED);
			const collection = get(activeCollection);
			if (collection) {
				saveReviewModeFor(collection.id, true); // Save review mode for this collection
			}
		}

		// 🧾 Guardar historial
		await _saveCompletedSessionToHistory(); // Call internal function
	}

	// SM-2 Logic Integration
	const cardId = get(currentCard)?.id;
	const collectionId = get(activeCollection)?.id;
	const collectionName = get(activeCollection)?.name; // Get collection name
	const quality = isCorrect ? 5 : 2; // Simplified mapping for SM-2

	if (cardId && collectionId && !get(isReviewMode)) {
		const sm2Payload: UpdateSM2Payload = {
			flashcardId: cardId,
			collectionId: collectionId,
			collectionName: collectionName,
			quality: quality
		};
		try {
			// const updatedSm2Record =
			await updateSM2Data(sm2Payload);
			// if (updatedSm2Record) {
			//    console.log('SM2 data updated via API:', updatedSm2Record);
			// }
		} catch (e) { // Should be caught by updateSM2Data itself, but for safety
			console.error('Failed to update SM-2 data (store level):', e);
		}
	}

	// Automatic Difficulty Detection Logic
	const currentCardDetails = get(currentCard); // Get the latest state of the current card
	// userId is not passed to getUserFlashcardSM2Record as API infers user
	if (currentCardDetails && !currentCardDetails.isDifficult) {
		const sm2Record: UserFlashcardSM2Record | null = await getUserFlashcardSM2Record(currentCardDetails.id);
		let autoMarkDifficult = false;

		if (currentCardDetails.incorrectCountInSession && currentCardDetails.incorrectCountInSession >= INCORRECT_THRESHOLD_SESSION) {
			autoMarkDifficult = true;
			console.log(`Card ${currentCardDetails.id} flagged difficult due to session incorrect count: ${currentCardDetails.incorrectCountInSession}.`);
		}

		if (sm2Record && sm2Record.easinessFactor < EF_DIFFICULTY_THRESHOLD) {
			autoMarkDifficult = true;
			console.log(`Card ${currentCardDetails.id} flagged difficult due to low EF: ${sm2Record.easinessFactor}.`);
		}

		if (autoMarkDifficult) {
			// Update in currentFlashcards
			currentFlashcards.update(cards => {
				const idx = cards.findIndex(c => c.id === currentCardDetails.id);
				if (idx !== -1) cards[idx].isDifficult = true;
				return cards;
			});
			// Update in masterSessionCards
			masterSessionCards.update(cards => {
				const idx = cards.findIndex(c => c.id === currentCardDetails.id);
				if (idx !== -1) cards[idx].isDifficult = true;
				return cards;
			});

			_persistDifficultStatus(currentCardDetails.id, true);
		}
	}

  await saveProgressForCurrentCollection(); // Save resumable progress
}

async function _persistDifficultStatus(cardId: string, makeDifficult: boolean): Promise<void> {
	// Note: This function does not take userId because the API endpoint /api/flashcards/:id
	// for PUT should implicitly handle user authorization if needed, or the card is global.
	// If card difficulty is per-user, the API and DB schema would need to reflect that,
	// and userId would be needed here. Assuming current API sets isDifficult globally on the card.
	try {
		const response = await fetch(`/api/flashcards/${cardId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isDifficult: makeDifficult })
		});

		if (!response.ok) {
			console.error(`API error setting difficult status for card ${cardId}: ${response.status}`);
			// Optionally, revert optimistic updates if any were made before calling this,
			// though for auto-detection, we might just log and move on.
		} else {
			console.log(`Card ${cardId} successfully marked as ${makeDifficult ? 'difficult' : 'not difficult'} via API.`);
			// If globalUserStats or another store caches card details including 'isDifficult',
			// it might need updating here. For now, this just calls the API.
		}
	} catch (err) {
		console.error(`Network error setting difficult status for card ${cardId}:`, err);
	}
}

// Internal function to save a completed session (full or filtered) to history
async function _saveCompletedSessionToHistory() {
	const collection = get(activeCollection);
	if (!collection) return;

	const sessionTypeVal: 'full' | 'failed_only' | 'unanswered_only' | 'review' = get(isReviewMode)
		? 'review'
		: get(isFilteredViewActive)
		? get(isUnansweredOnly)
			? 'unanswered_only'
			: 'failed_only'
		: 'full';

	let statusVal: 'completed' | 'mastered' = 'completed';
	if (
		sessionTypeVal === 'full' && !get(isReviewMode) && // Mastery only for full, non-review sessions
		get(incorrectAnswers) === 0 &&
		get(correctAnswers) === get(masterSessionCards).length
	) {
		statusVal = 'mastered';
	}

	const sessionEndTime = Date.now();
	const sessionData = {
		originalCollectionId: collection.id,
		collectionName: collection.name,
		sessionStartTime: get(sessionStartTime),
		sessionEndTime: sessionEndTime,
		durationMs: sessionEndTime - get(sessionStartTime),
		cardsInView: get(currentFlashcards).length,
		originalCollectionSize: get(masterSessionCards).length,
		cardsAttempted: get(currentFlashcards).length, // For completed sessions, all cards in view were attempted
		correct: get(correctAnswers),
		incorrect: get(incorrectAnswers),
		score: get(currentScore),
		streak: get(studyStats).correctStreak, // Maps to finalStreak
		longestStreak: get(studyStats).longestStreak, // Maps to longestStreakInSession
		sessionType: sessionTypeVal.toUpperCase(),
		status: statusVal.toUpperCase(),
	};

	try {
		const success = await saveSessionToHistory(sessionData);
		if (success) {
			console.log('Completed session history saved successfully.');
		} else {
			console.warn('Failed to save completed session history.');
		}
	} catch (e) {
		console.error('Error in _saveCompletedSessionToHistory:', e);
	}
}


// Navigation functions
export function nextCard() {
  currentIndex.update(idx => {
    const total = get(currentFlashcards).length;
    return (idx + 1) % total; // Loop back to start if at end
  });
  // Reset flip state for the new card
  currentFlashcards.update(cards => {
      const $currentIndexVal = get(currentIndex);
      if(cards[$currentIndexVal]) cards[$currentIndexVal].flipped = false;
      return cards;
  });
}

export function previousCard() {
  currentIndex.update(idx => {
    const total = get(currentFlashcards).length;
    return (idx - 1 + total) % total; // Loop back to end if at start
  });
   // Reset flip state for the new card
  currentFlashcards.update(cards => {
      const $currentIndexVal = get(currentIndex);
      if(cards[$currentIndexVal]) cards[$currentIndexVal].flipped = false;
      return cards;
  });
}

// Shuffle flashcards
export function shuffleFlashcards() {
    currentFlashcards.update(cards => {
        return cards
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
    });
    currentIndex.set(0); // Reset to first card after shuffle
    // Ensure new current card is not flipped
    currentFlashcards.update(cards => {
      if (cards.length > 0 && cards[0]) cards[0].flipped = false; // Ensure first card of shuffled list is not flipped
      return cards;
    });
    sessionCompleted.set(false); // Reset on shuffle
}

export function incrementTimesViewedForCurrentCard() {
  const index = get(currentIndex);
  currentFlashcards.update(cards => {
    if (cards[index]) {
      // Copia el array para forzar cambio de referencia
      const updatedCards = [...cards];
      updatedCards[index] = {
        ...cards[index],
        timesViewed: (cards[index].timesViewed || 0) + 1
      };
      return updatedCards;
    }
    return cards;
  });
}

export function incrementTimesViewedFor(cardId: string) {
	currentFlashcards.update(cards => {
		const updated = [...cards];
		const idx = updated.findIndex(c => c.id === cardId);
		if (idx !== -1) {
			updated[idx] = {
				...updated[idx],
				timesViewed: (updated[idx].timesViewed || 0) + 1
			};
		}
		return updated;
	});
}

// export function setUnansweredOnlyView(active: boolean) { // REMOVED - Handled by filterUnansweredCards & showAllCards
// 	isUnansweredOnly.set(active);
// }

// Helper to reset session scores and relevant studyStats for a sub-session (filtered views)
function resetSubSessionStats(preserveLongestStreak: boolean = true) {
	correctAnswers.set(0);
	incorrectAnswers.set(0);
	currentScore.set(0);
	studyStats.update(stats => ({
		...stats, // Keep existing badgesUnlocked
		totalViewed: 0,
		totalCorrect: 0,
		totalIncorrect: 0,
		correctStreak: 0,
		longestStreak: preserveLongestStreak ? stats.longestStreak : 0,
	}));
	sessionStartTime.set(Date.now());
}

export function filterUnansweredCards() {
	const allCards = get(masterSessionCards);
	const unansweredCards = allCards.filter(card => !card.answeredInSession);

	if (unansweredCards.length > 0) {
		resetSubSessionStats(true);
		currentFlashcards.set(unansweredCards.map(fc => ({ ...fc, flipped: false })));
		currentIndex.set(0);
		isFilteredViewActive.set(true);
		isUnansweredOnly.set(true);
		sessionCompleted.set(false);
	} else {
    if (get(isFilteredViewActive)) {
		  showAllCards();
    }
	}
}

// Function to filter for failed cards
export function filterFailedCards() {
  const allCards = get(masterSessionCards);
  const failedCards = allCards.filter(card => card.failedInSession);

  if (failedCards.length > 0) {
		resetSubSessionStats(true);
    currentFlashcards.set(failedCards.map(fc => ({ ...fc, flipped: false })));
    currentIndex.set(0);
    isFilteredViewActive.set(true);
    isUnansweredOnly.set(false);
    sessionCompleted.set(false);
  } else {
    if (get(isFilteredViewActive)) {
      showAllCards();
    }
  }
}

export function showAllCards() {
  currentFlashcards.set(get(masterSessionCards).map(fc => ({ ...fc, flipped: false })));
  isFilteredViewActive.set(false);
  isUnansweredOnly.set(false);

  const masterCards = get(masterSessionCards);
  const allMasterCardsAnswered = masterCards.every(fc => fc.answeredInSession);

  if (allMasterCardsAnswered) {
		sessionCompleted.set(true);
	} else {
    sessionCompleted.set(false);
  }
}

// This function is for a full reset of the entire collection's study state (e.g. "Study Again" from scratch)
export async function restartSessionForCurrentCollection(collectionId: string): Promise<void> {
  const currentActiveCollection = get(activeCollection);
  if (!currentActiveCollection || currentActiveCollection.id !== collectionId) {
    console.warn('Attempted to restart session for a collection that is not active or ID mismatch.');
    return;
  }
  // userId is no longer passed to clearStudyProgress as API infers user.
  try {
    const success = await clearStudyProgress(collectionId);
    if (success) {
      console.log(`Study progress for collection ${collectionId} cleared successfully via API.`);
    } else {
      console.warn(`Failed to clear study progress for collection ${collectionId} via API.`);
      // Decide if to proceed with local reset if API fails. For now, proceeding.
    }
  } catch (e) {
    console.error(`Error clearing study progress for collection ${collectionId} via API:`, e);
    // Decide if to proceed with local reset if API fails. For now, proceeding.
  }

  currentIndex.set(0);
  correctAnswers.set(0);
  incorrectAnswers.set(0);
  currentScore.set(0);
  sessionCompleted.set(false);
  isFilteredViewActive.set(false);
  isUnansweredOnly.set(false);
  isReviewMode.set(false);
  saveReviewModeFor(collectionId, false); // Persist review mode change

  studyStats.set({
    totalViewed: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    correctStreak: 0,
    longestStreak: 0,
    difficultAnswered: 0,
    badgesUnlocked: []
  });

  const pristineFlashcards = currentActiveCollection.flashcards.map(fc => ({
    ...fc,
    flipped: false,
    failedInSession: false,
    answeredInSession: false,
  }));

  masterSessionCards.set(pristineFlashcards);
  currentFlashcards.set(pristineFlashcards);
  sessionStartTime.set(Date.now());
  currentIndex.update(n => n);
}


// Reset store to initial state (typically when navigating away or changing collections fundamentally)
export function resetStudyState() {
  currentFlashcards.set(initialStudyState.flashcards);
  activeCollection.set(initialStudyState.activeCollection);
  currentIndex.set(initialStudyState.currentIndex);
  correctAnswers.set(initialStudyState.correctAnswers);
  incorrectAnswers.set(initialStudyState.incorrectAnswers);
  currentScore.set(initialStudyState.currentScore);
  sessionCompleted.set(initialStudyState.sessionCompleted);
  timerActive.set(initialStudyState.timerActive);
  isFilteredViewActive.set(initialStudyState.isFilteredViewActive);
  isUnansweredOnly.set(initialStudyState.isUnansweredOnly);
  isReviewMode.set(initialStudyState.isReviewMode); // Also reset review mode
  masterSessionCards.set([]); // Clear master session cards
  sessionStartTime.set(Date.now()); // Reset start time
  studyStats.set({ // Reset study stats to default
    totalViewed: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    correctStreak: 0,
    longestStreak: 0,
    difficultAnswered: 0,
    badgesUnlocked: []
  });
}


export async function saveProgressForCurrentCollection(): Promise<void> {
	console.log('saveProgressForCurrentCollection');
	const collection = get(activeCollection);
	console.log('collection', collection);
	if (!collection || get(isReviewMode)) { // Do not save progress if in review mode
    	 console.log('In review mode, progress not saved for collection:', collection?.id);
    	return;
  	}
  // userId is no longer passed to saveStudyProgress or updateLastStudiedTimestamp as API infers user.
  // const userId = get(page).data.user?.id;

	const flashcardsToSaveState = get(masterSessionCards).map(fc => ({
		id: fc.id,
		failedInSession: fc.failedInSession || false,
		answeredInSession: fc.answeredInSession || false
	}));

	// Construct payload matching UserProgressPayload from progressService.ts
	const progressToSave = {
		collectionId: collection.id,
		currentIndex: get(currentIndex),
		correctAnswers: get(correctAnswers),
		incorrectAnswers: get(incorrectAnswers),
		currentScore: get(currentScore),
		sessionCompleted: get(sessionCompleted),
		flashcardsState: flashcardsToSaveState,
		sessionStartTime: get(sessionStartTime), // This is a JS timestamp
		studyStats: get(studyStats)
		// lastReviewedTimestamp is not part of UserProgressPayload
		// lastSavedTimestamp is handled by the server
	};

	try {
		
		const success = await saveStudyProgress(progressToSave);
		console.log('Save Progress', success);
		if (success) {
			// console.log('Study progress saved successfully via API for collection:', collection.id);
			// Also update the last studied timestamp locally and via API
			// updateLastStudiedTimestamp will also need to be async if it becomes API-driven,
			// but for now, its internal API call will handle user context.
			updateLastStudiedTimestamp(collection.id, Date.now(), get(page).data.user?.id); // Pass userId here for now as collectionMetaService might still use it
		} else {
			console.warn('Failed to save study progress via API for collection:', collection.id);
		}
	} catch (e) {
		console.error('Error in saveProgressForCurrentCollection for collection:', collection.id, e);
	}
}

export async function triggerIncompleteSessionSave(saveStatus: 'incomplete' | 'abandoned') {
	const collection = get(activeCollection);
	const studyStatsSnapshot = get(studyStats);
	const sessionStartTimeVal = get(sessionStartTime);
	// const userId = get(page).data.user?.id; // Not needed for the new saveSessionToHistory call

	if (!collection || !sessionStartTimeVal) {
		console.log('Session not active or not started, not saving.');
		return;
	}

	if (get(sessionCompleted)) {
		console.log('Session already completed, not saving as incomplete/abandoned.');
		return;
	}

	const sessionEndTime = Date.now();
	const durationMs = sessionEndTime - sessionStartTimeVal;

	// Only save if some meaningful interaction: e.g. viewed at least one card OR spent some minimum time
	const minDurationMs = 3000; // 3 seconds
	const cardsViewedInSession = studyStatsSnapshot.totalViewed;

	if (cardsViewedInSession === 0 && durationMs < minDurationMs) {
		console.log('Minimal interaction, not saving session state.');
		return;
	}

	const sessionTypeVal: 'full' | 'failed_only' | 'unanswered_only' | 'review' = get(isReviewMode)
		? 'review'
		: get(isFilteredViewActive)
		? get(isUnansweredOnly)
			? 'unanswered_only'
			: 'failed_only'
		: 'full';

	const attemptedCardsInCurrentView = get(currentFlashcards).filter(fc => fc.answeredInSession).length;

	const sessionData = {
		originalCollectionId: collection.id,
		collectionName: collection.name,
		sessionStartTime: sessionStartTimeVal,
		sessionEndTime: sessionEndTime,
		durationMs: durationMs,
		cardsInView: get(currentFlashcards).length,
		originalCollectionSize: get(masterSessionCards).length,
		cardsAttempted: attemptedCardsInCurrentView,
		correct: get(correctAnswers),
		incorrect: get(incorrectAnswers),
		score: get(currentScore),
		streak: studyStatsSnapshot.correctStreak,
		longestStreak: studyStatsSnapshot.longestStreak,
		sessionType: sessionTypeVal.toUpperCase(),
		status: saveStatus.toUpperCase(),
	};

	try {
		const success = await saveSessionToHistory(sessionData);
		if (success) {
			console.log(`Incomplete/Abandoned session (${saveStatus}) history saved successfully.`);
		} else {
			console.warn(`Failed to save incomplete/abandoned session (${saveStatus}) history.`);
		}
	} catch (e) {
		console.error(`Error in triggerIncompleteSessionSave (${saveStatus}):`, e);
	}
}