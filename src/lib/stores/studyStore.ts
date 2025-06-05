import { studyStats } from '$lib/stores/studyStats';
import { writable, derived, get } from 'svelte/store'; // Added get here explicitly
import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
import { awardBadge, BadgeId } from '$lib/services/badgeService';
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
  showOnlyFailed: false, // Kept for potential direct use, though isFilteredViewActive is primary
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
export const showOnlyFailed = writable<boolean>(initialStudyState.showOnlyFailed); // Legacy or specific use
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
  const review = get(isReviewMode);

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
  if (savedProgress?.studyStats) {
    studyStats.set(savedProgress.studyStats);
  }

if (!review) {
  if (savedProgress) {
    currentIndex.set(savedProgress.currentIndex);
    correctAnswers.set(savedProgress.correctAnswers);
    incorrectAnswers.set(savedProgress.incorrectAnswers);
    currentScore.set(savedProgress.currentScore);

    if (savedProgress.sessionCompleted) {
      sessionCompleted.set(true); // ✅ Restauramos correctamente
    } else {
      sessionCompleted.set(false);
    }
  } else {
    // No hay progreso previo
    currentIndex.set(0);
    correctAnswers.set(0);
    incorrectAnswers.set(0);
    currentScore.set(0);
    sessionCompleted.set(false);
  }
} else {
  // review === true
  currentIndex.set(savedProgress?.currentIndex ?? 0);
  correctAnswers.set(savedProgress?.correctAnswers ?? 0);
  incorrectAnswers.set(savedProgress?.incorrectAnswers ?? 0);
  currentScore.set(savedProgress?.currentScore ?? 0);
  sessionCompleted.set(savedProgress?.sessionCompleted ?? false);
}

  // Estado global final
  sessionStartTime.set(Date.now());
  currentFlashcards.set(initialFlashcards);
  masterSessionCards.set(initialFlashcards);
  timerActive.set(true);
  showOnlyFailed.set(false);
  isFilteredViewActive.set(false);
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


  if (isCorrect && current  && current.failedInSession) {
    currentFlashcards.update((cards) =>
      cards.map((c) =>
        c.id === current.id
          ? { ...c, failedInSession: false }
          : c
      )
    );
  }
	// ✅ Protección inmediata
	if (!current || get(sessionCompleted)) return;
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
		return stats;
	});

	// 🧠 Actualizar contadores numéricos
	if (isCorrect) {
		correctAnswers.update(n => n + 1);
		currentScore.update(s => s + POINTS_PER_CORRECT_ANSWER);

		if (get(correctAnswers) === 10) {
			awardBadge(BadgeId.TEN_CORRECT_IN_SESSION);
		}
	} else {
		incorrectAnswers.update(n => n + 1);
	}

	// ✅ Validar final de sesión
	const allAnswered = get(currentFlashcards).every(fc => fc.answeredInSession);
	if (get(currentFlashcards).length > 0 && allAnswered) {
		sessionCompleted.set(true);
		awardBadge(BadgeId.FIRST_SESSION_COMPLETED);

		if (get(incorrectAnswers) === 0 && get(correctAnswers) === get(currentFlashcards).length) {
			awardBadge(BadgeId.COLLECTION_MASTERED);
			const collection = get(activeCollection);
			if (collection) {
				saveReviewModeFor(collection.id, true);
			}
		}

		// 🧾 Guardar historial
		const collection = get(activeCollection);
		if (collection) {
			saveSessionToHistory({
				collectionId: collection.id,
				collectionName: collection.name,
				timestamp: Date.now(),
				totalCards: get(currentFlashcards).length,
				correct: get(correctAnswers),
				incorrect: get(incorrectAnswers),
				score: get(currentScore),
				streak: get(studyStats).correctStreak,
				longestStreak: get(studyStats).longestStreak,
				durationMs: Date.now() - get(sessionStartTime) // Define esto al iniciar la sesión
			});
		}
	}

  saveProgressForCurrentCollection();
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
  const collection = get(activeCollection);
  if (!collection || !collection.flashcards) {
    console.warn('No active collection to filter.');
    return;
  }

  // Create a map of current flashcard states (including failedInSession) from the complete list in activeCollection
  // This ensures we have the latest failedInSession status for all cards, not just those currently visible if previously filtered.
  const currentSessionCardStates = new Map(
    get(currentFlashcards).map(card => [card.id, { ...card }])
  );

  const allCardsWithUpToDateState = collection.flashcards.map(originalCard => {
    const sessionState = currentSessionCardStates.get(originalCard.id);
    return {
      ...originalCard,
      flipped: false,
      timesViewed: sessionState?.timesViewed || originalCard.timesViewed || 0,
      timesCorrect: sessionState?.timesCorrect || originalCard.timesCorrect || 0,
      failedInSession: sessionState?.failedInSession || false,
      answeredInSession: sessionState?.answeredInSession ?? false
    };
  });

  const failedCards = allCardsWithUpToDateState.filter(card => card.failedInSession);

  if (failedCards.length > 0) {
    currentFlashcards.set(failedCards.map(fc => ({ ...fc, flipped: false })));
    currentIndex.set(0);
    isFilteredViewActive.set(true);
    if (failedCards.length > 0 && failedCards[0]) {
      failedCards[0].flipped = false; // Ensure new current card is not flipped
    }
    currentFlashcards.set(failedCards); // Update again to ensure reactivity on the flipped state of first card
  } else {
    if (get(isFilteredViewActive)) {
      showAllCards(); // This will also reset sessionCompleted to false
      return;
    }
  }
}

export function showAllCards() {
  currentFlashcards.set(get(masterSessionCards));
  isFilteredViewActive.set(false);
  showOnlyFailed.set(false);
  
  // ❗️ Solo restablecer si la sesión realmente no está completa
  const allAnswered = get(currentFlashcards).every(fc => fc.answeredInSession);
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
  showOnlyFailed.set(initialStudyState.showOnlyFailed); // Legacy
  isFilteredViewActive.set(initialStudyState.isFilteredViewActive);
  isUnansweredOnly.set(initialStudyState.isUnansweredOnly);

  
}

// Removed explicit get function as it's now imported from 'svelte/store'

export function saveProgressForCurrentCollection(): void {
	const collection = get(activeCollection);
	if (!collection) return;

	const flashcardsToSaveState = get(currentFlashcards).map(fc => ({
		id: fc.id,
		failedInSession: fc.failedInSession || false,
		answeredInSession: fc.answeredInSession || false
	}));

	const currentTimestamp = Date.now();

	const progressToSave: StudyProgress = {
		collectionId: collection.id,
		currentIndex: get(currentIndex),
		correctAnswers: get(correctAnswers),
		incorrectAnswers: get(incorrectAnswers),
		currentScore: get(currentScore),
		sessionCompleted: get(sessionCompleted),
		flashcardsState: flashcardsToSaveState,
		lastSavedTimestamp: currentTimestamp,
		lastReviewedIndex: get(currentIndex),
		lastReviewedTimestamp: currentTimestamp,

		// 🟢 Campos faltantes:
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

export function setUnansweredOnlyView(active: boolean) {
	isUnansweredOnly.set(active);
}

export function filterUnansweredCards() {
	const collection = get(activeCollection);
	if (!collection || !collection.flashcards) return;

	// 1. Captura estado de sesión actual (lo que el usuario ha interactuado)
	const sessionStateMap = new Map(
		get(currentFlashcards).map(card => [card.id, { ...card }])
	);

	// 2. Reconstruye estado maestro fusionando original + sesión
	const masterSessionCards: FlashcardStudy[] = collection.flashcards.map(original => {
		const session = sessionStateMap.get(original.id);
		return {
			...original,
			flipped: false,
			timesViewed: session?.timesViewed ?? original.timesViewed ?? 0,
			timesCorrect: session?.timesCorrect ?? original.timesCorrect ?? 0,
			answeredInSession: session?.answeredInSession ?? false,
			failedInSession: session?.failedInSession ?? false,
			isDifficult: session?.isDifficult ?? original.isDifficult ?? false
		};
	});

	// 3. Filtra solo las que no han sido respondidas
	const unansweredCards = masterSessionCards.filter(card => !card.answeredInSession);

	// 4. Aplica el filtro
	if (unansweredCards.length > 0) {
		currentFlashcards.set(unansweredCards);
		currentIndex.set(0);
		isFilteredViewActive.set(true);
		sessionCompleted.set(false);
	} else {
		// Si no hay tarjetas sin responder, mostrar todo
		showAllCards();
	}
}



export function restartSessionForCurrentCollection(collectionId: string) {
  const saved = loadStudyProgress(collectionId);
  if (saved) {
    clearStudyProgress(collectionId);
  }

  // Reset valores de sesión solo para esta colección
  currentIndex.set(0);
  correctAnswers.set(0);
  incorrectAnswers.set(0);
  currentScore.set(0);
  sessionCompleted.set(false);
  studyStats.set({
    totalViewed: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    correctStreak: 0,
    longestStreak: 0,
    difficultAnswered: 0,
    badgesUnlocked: []
  });

  const flashcards = get(masterSessionCards).map(fc => ({
    ...fc,
    flipped: false,
    failedInSession: false,
    answeredInSession: false
  }));

  currentFlashcards.set(flashcards);
  sessionStartTime.set(Date.now());
  currentIndex.update(n => n); // fuerza actualización visual
}