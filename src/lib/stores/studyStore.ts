import { writable, derived, get } from 'svelte/store'; // Added get here explicitly
import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
import { awardBadge, BadgeId } from '$lib/services/badgeService';
import { loadStudyProgress, saveStudyProgress, clearStudyProgress, type StudyProgress } from '$lib/services/progressService';
import { updateLastStudiedTimestamp } from '$lib/services/collectionMetaService';

export interface FlashcardStudy extends PrismaFlashcard {
  flipped?: boolean;
  failedInSession?: boolean;
  isDifficult?: boolean; // New field
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
  currentScore: 0,
  sessionCompleted: false, // New state
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

// Constants
const POINTS_PER_CORRECT_ANSWER = 10;

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


// Function to load a new collection for study
export function loadCollectionForStudy(collectionData: CollectionWithFlashcards | null) {
  if (collectionData && collectionData.flashcards) {
    const savedProgress = loadStudyProgress(collectionData.id);

    let initialFlashcards = collectionData.flashcards.map(fc => ({
      ...fc, // fc from API should now include isDifficult due to prisma client update
      flipped: false,
      failedInSession: false,
      isDifficult: fc.isDifficult || false, // Initialize isDifficult
      timesViewed: fc.timesViewed || 0,
      timesCorrect: fc.timesCorrect || 0,
    }));

    activeCollection.set(collectionData);

    // Check if progress should be loaded or if session should start fresh
    if (savedProgress && !savedProgress.sessionCompleted) { // <<< MODIFIED CONDITION HERE
      // Rehydrate from saved progress because it was not completed
      currentIndex.set(savedProgress.currentIndex);
      correctAnswers.set(savedProgress.correctAnswers);
      incorrectAnswers.set(savedProgress.incorrectAnswers);
      currentScore.set(savedProgress.currentScore);
      sessionCompleted.set(false); // Start un-completed, even if saved one was (should not happen with new condition)

      const savedFlashcardsState = new Map(savedProgress.flashcardsState.map(fs => [fs.id, fs]));
      initialFlashcards = initialFlashcards.map(card => {
        const savedCardState = savedFlashcardsState.get(card.id);
        return {
          ...card, // This includes isDifficult from the initial mapping
          failedInSession: savedCardState?.failedInSession || card.failedInSession || false,
        };
      });
      // console.log('Resuming progress for collection:', collectionData.id);
    } else {
      // No saved progress, or saved progress was for a completed session, so start fresh.
      // If savedProgress existed but was completed, clear it now.
      if (savedProgress && savedProgress.sessionCompleted) {
        clearStudyProgress(collectionData.id);
        // console.log('Cleared completed session progress for:', collectionData.id);
      }
      currentIndex.set(0);
      correctAnswers.set(0);
      incorrectAnswers.set(0);
      currentScore.set(0);
      sessionCompleted.set(false);
      // `initialFlashcards` remains as freshly mapped with all `failedInSession: false`
      // console.log('Starting fresh session for collection:', collectionData.id);
    }
    currentFlashcards.set(initialFlashcards);
    timerActive.set(true);
    showOnlyFailed.set(false);
    isFilteredViewActive.set(false);

  } else {
    resetStudyState();
  }
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
  currentFlashcards.update(cards => {
    const $currentIndexVal = get(currentIndex);
    if (cards[$currentIndexVal]) {
      if (isCorrect) {
        // Optionally reset failedInSession if a card is later answered correctly
        // For now, we keep it simple: once failed, it's marked for the session filter.
        // cards[$currentIndexVal].failedInSession = false;
      } else {
        cards[$currentIndexVal].failedInSession = true;
      }
    }
    return cards;
  });

  // Removed prevCorrect and prevIncorrect as we'll use get() on updated values later.

  if (isCorrect) {
    correctAnswers.update(n => n + 1);
    currentScore.update(s => s + POINTS_PER_CORRECT_ANSWER);

    // Check for TEN_CORRECT_IN_SESSION badge
    if (get(correctAnswers) === 10) { // This uses the just-updated value
      awardBadge(BadgeId.TEN_CORRECT_IN_SESSION);
    }
  } else {
    incorrectAnswers.update(n => n + 1);
    // No score change for incorrect, or could deduct points if desired
  }

  // Check for session completion after answer counts are updated
  const totalCardsInCurrentView = get(currentFlashcards).length;
  const currentCorrectAnswers = get(correctAnswers);
  const currentIncorrectAnswers = get(incorrectAnswers);
  const totalAnswersGiven = currentCorrectAnswers + currentIncorrectAnswers;

  if (totalCardsInCurrentView > 0 && totalAnswersGiven >= totalCardsInCurrentView) {
    // This logic assumes every card is answered once.
    sessionCompleted.set(true);

    // Award session-dependent badges now that session is marked complete
    awardBadge(BadgeId.FIRST_SESSION_COMPLETED); // AwardBadge handles if it's truly the first time

    // Check for COLLECTION_MASTERED badge
    if (currentIncorrectAnswers === 0 && currentCorrectAnswers === totalCardsInCurrentView) {
      awardBadge(BadgeId.COLLECTION_MASTERED);
    }
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
        let shuffled = cards
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
        return shuffled;
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
      ...originalCard, // base data from collection
      flipped: false, // always reset flip
      timesViewed: sessionState?.timesViewed || originalCard.timesViewed || 0,
      timesCorrect: sessionState?.timesCorrect || originalCard.timesCorrect || 0,
      failedInSession: sessionState?.failedInSession || false, // Crucially use the up-to-date failedInSession
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
  sessionCompleted.set(false); // Reset on filtering
}

export function showAllCards() {
  const collection = get(activeCollection);
  if (collection && collection.flashcards) {
    // Similar to filterFailedCards, ensure we use the most complete view of session states
    const currentSessionCardStates = new Map(
      get(currentFlashcards).map(card => [card.id, { ...card }])
    );

    const processedFlashcards = collection.flashcards.map(originalCard => {
      const sessionState = currentSessionCardStates.get(originalCard.id);
      // If a card was in a filtered list (e.g. failed cards), its state is in currentSessionCardStates.
      // If it wasn't (e.g. it was a correctly answered card not in the failed list),
      // its failedInSession state should be what it was before filtering.
      // This logic still has a slight gap if markAnswer only updates visible cards.
      // The most robust solution is for markAnswer to update a "master" list in memory.
      // For now, this is an improvement:
      let failedInSessionState = sessionState?.failedInSession || false;
      if (!isFilteredViewActive && sessionState) { // If showing all, and card was in previous "all" list
          failedInSessionState = sessionState.failedInSession;
      } else if (isFilteredViewActive && !sessionState) {
          // Card was not in the failed list, so its failedInSession should be false
          // (or its last known state if we had a master list)
          failedInSessionState = false;
      }


      return {
        ...originalCard,
        flipped: false,
        timesViewed: sessionState?.timesViewed || originalCard.timesViewed || 0,
        timesCorrect: sessionState?.timesCorrect || originalCard.timesCorrect || 0,
        failedInSession: failedInSessionState,
      };
    });
    currentFlashcards.set(processedFlashcards);
  }
  currentIndex.set(0);
  isFilteredViewActive.set(false);
  currentFlashcards.update(cards => {
    if (cards.length > 0 && cards[0]) cards[0].flipped = false;
    return cards;
  });
  sessionCompleted.set(false); // Reset on showing all cards
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
}

// Removed explicit get function as it's now imported from 'svelte/store'

export function saveProgressForCurrentCollection(): void {
  const collection = get(activeCollection);
  if (!collection) return; // No active collection, nothing to save

  const flashcardsToSaveState = get(currentFlashcards).map(fc => ({
    id: fc.id,
    failedInSession: fc.failedInSession || false,
    // other per-card state if needed in future
  }));

  const currentTimestamp = Date.now(); // Define currentTimestamp here

  const progressToSave: StudyProgress = {
    collectionId: collection.id,
    currentIndex: get(currentIndex),
    correctAnswers: get(correctAnswers),
    incorrectAnswers: get(incorrectAnswers),
    currentScore: get(currentScore),
    sessionCompleted: get(sessionCompleted),
    flashcardsState: flashcardsToSaveState,
    lastSavedTimestamp: currentTimestamp, // Save this for detailed session resume
  };
  saveStudyProgress(progressToSave); // From progressService

  // Also update the separate lastStudiedTimestamp for easier access by other parts of the app
  updateLastStudiedTimestamp(collection.id, currentTimestamp); // From collectionMetaService
  // console.log(`Overall lastStudiedTimestamp updated for ${collection.id}`);
}
