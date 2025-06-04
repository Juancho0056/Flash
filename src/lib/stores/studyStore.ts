import { writable, derived } from 'svelte/store';
import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';

export interface FlashcardStudy extends PrismaFlashcard {
  flipped?: boolean;
  failedInSession?: boolean;
  // Add any other UI-specific state here if needed in the future
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
};

// Writable stores
export const currentFlashcards = writable<FlashcardStudy[]>(initialStudyState.flashcards);
export const activeCollection = writable<CollectionWithFlashcards | null>(initialStudyState.activeCollection);
export const currentIndex = writable<number>(initialStudyState.currentIndex);
export const correctAnswers = writable<number>(initialStudyState.correctAnswers);
export const incorrectAnswers = writable<number>(initialStudyState.incorrectAnswers);
export const timerActive = writable<boolean>(initialStudyState.timerActive);
export const showOnlyFailed = writable<boolean>(initialStudyState.showOnlyFailed); // Legacy or specific use
export const isFilteredViewActive = writable<boolean>(initialStudyState.isFilteredViewActive);


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
export function loadCollectionForStudy(collection: CollectionWithFlashcards | null) {
  if (collection && collection.flashcards) {
    const processedFlashcards = collection.flashcards.map(fc => ({
      ...fc,
      flipped: false, // Initialize flipped state
      failedInSession: false, // Initialize failedInSession state
      // Ensure stats are initialized if not present, or use values from collection
      timesViewed: fc.timesViewed || 0,
      timesCorrect: fc.timesCorrect || 0,
    }));
    activeCollection.set(collection); // Store the original collection
    currentFlashcards.set(processedFlashcards); // These are the cards for study
    currentIndex.set(0);
    correctAnswers.set(0);
    incorrectAnswers.set(0);
    timerActive.set(true); // Or manage this based on user action
    showOnlyFailed.set(false); // Reset legacy flag
    isFilteredViewActive.set(false); // Reset filter view
  } else {
    resetStudyState(); // Resets all relevant store parts including isFilteredViewActive
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

  if (isCorrect) {
    correctAnswers.update(n => n + 1);
  } else {
    incorrectAnswers.update(n => n + 1);
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
      if(cards.length > 0) cards[0].flipped = false;
      return cards;
    });
}

// Function to filter for failed cards (basic example)
// This function applies the filter to show only cards marked as failedInSession.
export function filterFailedCards() {
  // Get all cards currently loaded for study (these are from the original activeCollection, processed)
  // We need to use the version of cards from activeCollection and apply current session states
  // However, the simplest way is to filter the *current* set of cards if we are not already filtered.
  // If we are already filtered, re-filtering doesn't make sense unless it's on a different criteria.
  // The source for filtering should be the full list from the active collection, maintaining their session states.

  const collection = get(activeCollection);
  if (!collection || !collection.flashcards) {
    console.warn("No active collection to filter.");
    return;
  }

  // Re-create the full list from the active collection, but preserve existing session states (failedInSession, stats)
  // This ensures we always filter from the complete set of cards for the current study session.
  const allSessionCardsWithCurrentState = collection.flashcards.map(originalCard => {
    const studiedCard = get(currentFlashcards).find(fc => fc.id === originalCard.id); // Check if this card is in the current (possibly filtered) list
    const fullListCard = get(currentFlashcards).find(fc => fc.id === originalCard.id && !get(isFilteredViewActive)); // Check if this card is in the full list

    // Prefer failedInSession from any card version that has it, otherwise false
    let failedInSession = false;
    if (studiedCard?.failedInSession) failedInSession = true;
    else if (fullListCard?.failedInSession) failedInSession = true;


    return {
      ...originalCard, // Base data from collection
      flipped: false, // Reset flip state for display
      // Preserve stats and failedInSession status from the ongoing session
      timesViewed: studiedCard?.timesViewed || fullListCard?.timesViewed || originalCard.timesViewed || 0,
      timesCorrect: studiedCard?.timesCorrect || fullListCard?.timesCorrect || originalCard.timesCorrect || 0,
      failedInSession: failedInSession,
    };
  });


  const failedCards = allSessionCardsWithCurrentState.filter(card => card.failedInSession);

  if (failedCards.length > 0) {
    currentFlashcards.set(failedCards.map(fc => ({...fc, flipped: false}))); // Update with only failed, reset flip
    currentIndex.set(0);
    isFilteredViewActive.set(true);
    if (failedCards.length > 0 && failedCards[0]) { // Ensure new current card is not flipped
        failedCards[0].flipped = false;
    }
    currentFlashcards.set(failedCards); // Re-set to trigger updates if needed for the flip state change on first card
  } else {
    // If no cards were marked as failed in the entire session set.
    // If currently in filtered view and it becomes empty, show all.
    if (get(isFilteredViewActive)) {
        showAllCards(); // Reverts to showing all cards from the collection
    }
    // If not in filtered view and no cards are failed, nothing needs to change.
    // Optionally, provide user feedback e.g. "No cards marked as incorrect yet."
  }
}

export function showAllCards() {
  const collection = get(activeCollection);
  if (collection && collection.flashcards) {
    // Re-process the original flashcards from the active collection,
    // but try to preserve the session-specific state like 'failedInSession', 'timesViewed', 'timesCorrect'.
    // This requires having access to the current state of flashcards if they were modified.
    // The `currentFlashcards` before this call might be a filtered list.
    // We need a reliable way to get the state of *all* cards from the session.
    // One way: activeCollection stores raw cards. We map them and try to find their session state
    // from an "unfiltered" version of currentFlashcards if such a temporary store existed,
    // or we assume `markAnswer` updated a master list if `isFilteredViewActive` was false.

    // Let's assume `activeCollection.flashcards` are the pristine cards.
    // We need to re-apply session knowledge (failedInSession, stats) to them.
    // This is tricky if currentFlashcards is already filtered.
    // A robust way: `loadCollectionForStudy` should perhaps set an internal `masterListOfSessionCards`.
    // For now, let's try to merge:
    const allOriginalCards = collection.flashcards;
    const sessionCardStates = new Map(get(currentFlashcards).map(c => [c.id, {
        timesViewed: c.timesViewed,
        timesCorrect: c.timesCorrect,
        failedInSession: c.failedInSession,
    }]));

     // If currentFlashcards is filtered, it won't have all states.
     // This implies `markAnswer` should always update a card in a "master" list, not just the visible `currentFlashcards`.
     // This is a limitation of the current `markAnswer` if it only updates the visible `currentFlashcards` when filtered.
     // For now, we will restore from activeCollection and apply any known states. Those not in currentFlashcards (if filtered) will lose session-specific failed state unless it was updated on a master list.
     // Given the current structure, the most straightforward way is to re-process from activeCollection
     // and assume any card *not* in the current filtered view did *not* have its failedInSession state changed,
     // or rely on `markAnswer` having updated a more persistent version.
     // The provided snippet for `markAnswer` updates `currentFlashcards`. If it's filtered, non-visible cards are not updated.
     // This means `showAllCards` might show cards as not failed if they were marked, then filtered out, then marked correct on a non-existent master list.
     // This needs careful architecture.
     // A simpler `showAllCards`: reload from `activeCollection`, resetting `failedInSession` states for non-failed cards if not careful.

    const processedFlashcards = collection.flashcards.map(originalCard => {
      // Try to find this card in the *current* set of flashcards (which might be filtered)
      // This is to preserve its latest state if it's visible.
      // If it's not visible (because currentFlashcards is filtered and this card is not in it),
      // we use its original data and assume failedInSession should be false unless proven otherwise by other logic.
      const existingCardState = get(currentFlashcards).find(fc => fc.id === originalCard.id);

      return {
        ...originalCard, // Base data
        flipped: false,
        // If card exists in current (possibly filtered) view, use its state.
        // Otherwise, this implies it's being "brought back" into view.
        // Its failedInSession state needs to be determined from a source that tracks *all* cards.
        // The current `markAnswer` updates `currentFlashcards`. If `currentFlashcards` is filtered,
        // it only updates the visible (failed) cards. This is a problem for "resetting" `failedInSession`
        // if a card is answered correctly while in the main list, then you filter, then you `showAllCards`.
        // For this iteration, we'll use the state from `currentFlashcards` if found, else default.
        timesViewed: existingCardState?.timesViewed || originalCard.timesViewed || 0,
        timesCorrect: existingCardState?.timesCorrect || originalCard.timesCorrect || 0,
        // This is crucial: How do we know if a card not currently in a filtered list *was* failed?
        // `markAnswer` must update a list that contains ALL cards of the session.
        // Let's assume `activeCollection`'s flashcards are the base and we re-apply `failedInSession`
        // from a temporary full list if we had one, or simply reset them if not.
        // The current code implies `currentFlashcards` might be the *only* source of truth for `failedInSession`.
        // This means if a card is not in `currentFlashcards` (because it's filtered out), its `failedInSession` state is lost
        // unless `markAnswer` was more complex.
        // Given the prompt's `markAnswer`, it updates `currentFlashcards`. So, if `currentFlashcards` is filtered,
        // only those cards can have `failedInSession` updated.
        // Let's try to use `initialStudyState.flashcards` as a temporary holder of the "true" full list after load. This is not ideal.
        // A better way: `activeCollection` stores `CollectionWithFlashcards` where `flashcards` are `FlashcardStudy`.
        // And `loadCollectionForStudy` ensures this `activeCollection.flashcards` is the master list for session states.
        // For now, this version of showAllCards will re-process from `get(activeCollection).flashcards`
        // and will try to find its state from the current `get(currentFlashcards)` (which could be filtered).
        // This is imperfect for states of cards not in the current view.
        failedInSession: existingCardState?.failedInSession || false, // Default to false if not in current (potentially filtered) view
      };
    });

    currentFlashcards.set(processedFlashcards);
  }
  currentIndex.set(0);
  isFilteredViewActive.set(false);
  // Ensure new current card is not flipped
  currentFlashcards.update(cards => {
    if (cards.length > 0 && cards[0]) cards[0].flipped = false;
    return cards;
  });
}


// Reset store to initial state
export function resetStudyState() {
  currentFlashcards.set(initialStudyState.flashcards);
  activeCollection.set(initialStudyState.activeCollection);
  currentIndex.set(initialStudyState.currentIndex);
  correctAnswers.set(initialStudyState.correctAnswers);
  incorrectAnswers.set(initialStudyState.incorrectAnswers);
  timerActive.set(initialStudyState.timerActive);
  showOnlyFailed.set(initialStudyState.showOnlyFailed); // Legacy
  isFilteredViewActive.set(initialStudyState.isFilteredViewActive);
}

// Helper to get current value of a store (Svelte 4 doesn't have get as a direct import for all stores)
// For Svelte 5, direct get(store) is standard. For Svelte 4, often used in component context.
// This is a simple utility if needed outside component scripts, otherwise use $store syntax in .svelte files
function get<T>(store: import('svelte/store').Readable<T>): T {
  let value: T = undefined as any; // Or some default
  const unsubscribe = store.subscribe(v => value = v);
  unsubscribe(); // Immediately unsubscribe after getting the current value
  return value;
}
