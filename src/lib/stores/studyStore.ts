import { studyStats } from '$lib/stores/studyStats';
import { writable, derived, get } from 'svelte/store';
import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
import { awardBadge, BadgeId, allBadges as allBadgesDefinitions } from '$lib/services/badgeService'; // Import BadgeId and awardBadge
import { globalUserStats, incrementTotalCorrectAnswersAllTime } from '$lib/stores/globalUserStats'; // Import global stats
import { loadStudyProgress, saveStudyProgress, type StudyProgress } from '$lib/services/progressService';
import { updateLastStudiedTimestamp } from '$lib/services/collectionMetaService';
import { saveSessionToHistory } from '$lib/services/studyHistoryService';
import { clearStudyProgress } from '$lib/services/progressService';

export interface FlashcardStudy extends PrismaFlashcard {
  flipped?: boolean;
  failedInSession?: boolean;
  answeredInSession?: boolean; // ✅ NUEVO
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
const reviewModeStorageKey = 'reviewModeByCollection';
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
	const map = JSON.parse(sessionStorage.getItem(reviewModeStorageKey) || '{}');
	const active = !!map[collectionId];
	isReviewMode.set(active);
}

export function saveReviewModeFor(collectionId: string, value: boolean) {
	const map = JSON.parse(sessionStorage.getItem(reviewModeStorageKey) || '{}');
	map[collectionId] = value;
	sessionStorage.setItem(reviewModeStorageKey, JSON.stringify(map));
	isReviewMode.set(value);
}
// Function to load a new collection for study
export function loadCollectionForStudy(collectionData: CollectionWithFlashcards | null) {
  if (!collectionData || !collectionData.flashcards) {
    resetStudyState();
    return;
  }

  loadReviewModeFor(collectionData.id);
  const savedProgress = loadStudyProgress(collectionData.id);
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
      isDifficult: fc.isDifficult ?? false,
      timesViewed: fc.timesViewed ?? 0,
      timesCorrect: fc.timesCorrect ?? 0
    };
  });

  // Restaurar stats si existen
  // Load initialFlashcards state (failedInSession, answeredInSession) REGARDLESS of review mode
  // as this reflects the actual learned state of cards.
  currentFlashcards.set(initialFlashcards);
  masterSessionCards.set(initialFlashcards);

  if (review) {
    // In Review Mode: Reset session-specific stats, keep learned card states.
    correctAnswers.set(0);
    incorrectAnswers.set(0);
    currentScore.set(0);
    studyStats.set({ // Reset to initial study stats
      totalViewed: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      correctStreak: 0,
      longestStreak: 0,
      difficultAnswered: 0,
      badgesUnlocked: [] // Badges probably should not be re-unlocked in review
    });
    currentIndex.set(0); // Start from the beginning
    sessionCompleted.set(false); // A review session is a new, uncompleted session
    sessionStartTime.set(Date.now()); // Fresh start time for review session
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
export function markAnswer(isCorrect: boolean) {
	const current = get(currentCard);

	// ✅ Protección inmediata
	if (!current || (get(sessionCompleted) && !get(isFilteredViewActive))) return; // Allow marking answers if session is completed BUT a filter is active
  // If no filter active and session is completed, then no more marking.
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
		updated[idx] = {
			...card,
			answeredInSession: true,
			failedInSession: isCorrect ? false : true
		};
		return updated;
	});

	// 🟦 Actualizar masterSessionCards
	masterSessionCards.update(cards => {
		const idx = cards.findIndex(c => c.id === current.id);
		if (idx === -1 || cards[idx].answeredInSession) return cards;

		const updated = [...cards];
		updated[idx] = {
			...cards[idx],
			answeredInSession: true,
			failedInSession: isCorrect ? false : true
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
		correctAnswers.update(n => n + 1);
		currentScore.update(s => s + POINTS_PER_CORRECT_ANSWER);
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

		// Check for collection mastery
		if (get(incorrectAnswers) === 0 && get(correctAnswers) === get(currentFlashcards).length) {
			awardBadge(BadgeId.COLLECTION_MASTERED);
			const collection = get(activeCollection);
			if (collection) {
				saveReviewModeFor(collection.id, true); // Save review mode for this collection
			}
		}

		// 🧾 Guardar historial
		_saveCompletedSessionToHistory(); // Call internal function
	}

  saveProgressForCurrentCollection(); // Save resumable progress
}

// Internal function to save a completed session (full or filtered) to history
function _saveCompletedSessionToHistory() {
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

	// For 'completed' or 'mastered' sessions, totalCards studied is the length of the set just completed.
	const cardsInThisSpecificSession = get(currentFlashcards).length;

	saveSessionToHistory({ // This calls the imported service function
		collectionId: collection.id,
		collectionName: collection.name,
		timestamp: Date.now(), // Session end time
		sessionStartTime: get(sessionStartTime),
		durationMs: Date.now() - get(sessionStartTime),
		totalCards: cardsInThisSpecificSession, // Cards in this particular completed segment
		originalCollectionSize: get(masterSessionCards).length,
		correct: get(correctAnswers),
		incorrect: get(incorrectAnswers),
		score: get(currentScore),
		streak: get(studyStats).correctStreak,
		longestStreak: get(studyStats).longestStreak,
		sessionType: sessionTypeVal,
		status: statusVal
	});
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

// Function to filter for failed cards
export function filterFailedCards() {
  const allCards = get(masterSessionCards);
  const failedCards = allCards.filter(card => card.failedInSession);

  if (failedCards.length > 0) {
    currentFlashcards.set(failedCards.map(fc => ({ ...fc, flipped: false }))); // Ensure cards are not flipped when entering mode
    currentIndex.set(0);
    isFilteredViewActive.set(true);
    isUnansweredOnly.set(false); // Not in "unanswered only" mode
    // sessionCompleted should not be reset here, allow completing the filtered set
  } else {
    // No failed cards to show. If already in a filtered view, show all. Otherwise, do nothing (UI should prevent entering).
    if (get(isFilteredViewActive)) {
      showAllCards();
    }
    // Consider a toast message or similar if user tries to activate and there are none (handled in UI)
  }
}

export function showAllCards() {
  currentFlashcards.set(get(masterSessionCards).map(fc => ({ ...fc, flipped: false }))); // Reset flipped state for all
  isFilteredViewActive.set(false);
  isUnansweredOnly.set(false); // Ensure this is also reset
  // showOnlyFailed.set(false); // REMOVED
  
  // Re-evaluate sessionCompleted state only if not already truly completed with all cards
  const masterCards = get(masterSessionCards);
  const allAnswered = masterCards.every(fc => fc.answeredInSession);
  const allCorrect = get(currentFlashcards).every(fc => fc.answeredInSession && !fc.failedInSession);
  
  if (!allAnswered || !allCorrect) {
    sessionCompleted.set(false);
  }
}

// Reset store to initial state
export function resetStudyState() {
  currentFlashcards.set(initialStudyState.flashcards);
  activeCollection.set(initialStudyState.activeCollection);
  currentIndex.set(initialStudyState.currentIndex);
  correctAnswers.set(initialStudyState.correctAnswers);
  incorrectAnswers.set(initialStudyState.incorrectAnswers);
  currentScore.set(initialStudyState.currentScore); // Reset score
  sessionCompleted.set(initialStudyState.sessionCompleted); // Reset session completed state
  timerActive.set(initialStudyState.timerActive);
  // showOnlyFailed.set(initialStudyState.showOnlyFailed); // REMOVED
  isFilteredViewActive.set(initialStudyState.isFilteredViewActive);
  isUnansweredOnly.set(initialStudyState.isUnansweredOnly);
}


export function saveProgressForCurrentCollection(): void {
	const collection = get(activeCollection);
	if (!collection) return;

	const collection = get(activeCollection);
	if (!collection || get(isReviewMode)) { // Do not save progress if in review mode
    // console.log('In review mode, progress not saved.');
    return;
  }

	// Save state of ALL cards from masterSessionCards
	const flashcardsToSaveState = get(masterSessionCards).map(fc => ({
		id: fc.id,
		failedInSession: fc.failedInSession || false, // Ensure defaults if undefined
		answeredInSession: fc.answeredInSession || false // Ensure defaults if undefined
	}));

	const currentTimestamp = Date.now();

	const progressToSave: StudyProgress = {
		collectionId: collection.id,
		currentIndex: get(currentIndex),
		correctAnswers: get(correctAnswers),
		incorrectAnswers: get(incorrectAnswers),
		currentScore: get(currentScore),
		sessionCompleted: get(sessionCompleted),
		flashcardsState: flashcardsToSaveState, // Now uses master list
		lastSavedTimestamp: currentTimestamp,
		// lastReviewedIndex: get(currentIndex), // REMOVED
		lastReviewedTimestamp: currentTimestamp,
		sessionStartTime: get(sessionStartTime),
		studyStats: get(studyStats)
	};

	saveStudyProgress(progressToSave);
	updateLastStudiedTimestamp(collection.id, currentTimestamp);
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
export function restartSessionForCurrentCollection(collectionId: string) {
  const currentActiveCollection = get(activeCollection);
  if (!currentActiveCollection || currentActiveCollection.id !== collectionId) {
    console.warn('Attempted to restart session for a collection that is not active or ID mismatch.');
    return;
  }

  clearStudyProgress(collectionId);

  currentIndex.set(0);
  correctAnswers.set(0);
  incorrectAnswers.set(0);
  currentScore.set(0);
  sessionCompleted.set(false);
  isFilteredViewActive.set(false);
  isUnansweredOnly.set(false);
  isReviewMode.set(false);

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


export function saveProgressForCurrentCollection(): void {
	const collection = get(activeCollection);
	if (!collection || get(isReviewMode)) { // Do not save progress if in review mode
    // console.log('In review mode, progress not saved.');
    return;
  }

	// Save state of ALL cards from masterSessionCards
	const flashcardsToSaveState = get(masterSessionCards).map(fc => ({
		id: fc.id,
		failedInSession: fc.failedInSession || false, // Ensure defaults if undefined
		answeredInSession: fc.answeredInSession || false // Ensure defaults if undefined
	}));

	const currentTimestamp = Date.now();

	const progressToSave: StudyProgress = {
		collectionId: collection.id,
		currentIndex: get(currentIndex),
		correctAnswers: get(correctAnswers),
		incorrectAnswers: get(incorrectAnswers),
		currentScore: get(currentScore),
		sessionCompleted: get(sessionCompleted),
		flashcardsState: flashcardsToSaveState, // Now uses master list
		lastSavedTimestamp: currentTimestamp,
		// lastReviewedIndex: get(currentIndex), // REMOVED
		lastReviewedTimestamp: currentTimestamp,
		sessionStartTime: get(sessionStartTime),
		studyStats: get(studyStats)
	};

	saveStudyProgress(progressToSave);
	updateLastStudiedTimestamp(collection.id, currentTimestamp);
}