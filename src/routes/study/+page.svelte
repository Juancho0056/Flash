<!-- src/routes/study/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store'; // Added get
	import { page } from '$app/stores'; // Added page store
	import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
	import Card from '$lib/components/Card.svelte'; // Import the component
	import SessionStats from '$lib/components/SessionStats.svelte'; // Import SessionStats component
	import { tick } from 'svelte';
	import {
		currentFlashcards,
		activeCollection,
		currentIndex,
		correctAnswers,
		incorrectAnswers,
		// timerActive, // Assuming timerActive might be used later for UI features
		currentCard,
		currentScore,
		sessionCompleted, // Import sessionCompleted
		progressPercentage,
		totalFlashcards,
		loadCollectionForStudy,
		flipCard,
		markAnswer,
		nextCard,
		previousCard,
		shuffleFlashcards,
		resetStudyState,
		isFilteredViewActive, // Import new store state
		isUnansweredOnly, // To display (Unanswered Only) or (Failed Only)
		filterFailedCards, // Import new actions
		showAllCards,
		saveProgressForCurrentCollection, // Import saveProgressForCurrentCollection
		incrementTimesViewedForCurrentCard,
		filterUnansweredCards,
		// setUnansweredOnlyView, // REMOVED: Store now handles this internally
		isReviewMode,
		incrementTimesViewedFor,
		// showOnlyFailed, // REMOVED: Store now handles this internally
		triggerIncompleteSessionSave,
		restartSessionForCurrentCollection,
		isFocusModeActive, // Focus Mode
		toggleFocusMode // Focus Mode
	} from '$lib/stores/studyStore';
	import type { CollectionWithFlashcards, FlashcardStudy } from '$lib/stores/studyStore';
	import Modal from '$lib/components/Modal.svelte'; // Import Modal
	import { toast } from '$lib/toastStore'; // Import toast
	import { awardBadge, BadgeId } from '$lib/services/badgeService';
	import { afterUpdate } from 'svelte'; // Import afterUpdate for reactive updates
	// import { ttsSettings, updateTTSSettings } from '$lib/stores/ttsStore'; // Import TTS store and updater
	import {
		ttsSettings,
		startPlayback,
		pausePlayback,
		stopPlayback, // if you plan to use a dedicated stop button
		setPlaybackSpeed,
		updateTTSSettings
	} from '$lib/stores/ttsStore';
	import { get } from 'svelte/store'; // Ensure 'get' is imported
	import { tick } from 'svelte'; // Ensure 'tick' is imported


	let cardComponent: Card; // To call speakCardDetails

	// Reactive variables for UI binding
	let isPlaying: boolean;
	let playbackSpeed: number;
	// autoPlayTTS is already declared in the original file, ensure it's updated by ttsSettings subscription
	// let autoPlayTTS: boolean;


	ttsSettings.subscribe(settings => {
		isPlaying = settings.isPlaying;
		playbackSpeed = settings.playbackSpeed;
		// autoPlayTTS = settings.autoPlay; // Ensure this is the existing autoPlayTTS from the outer scope - REMOVED
	});

	// Handler for playback speed change
	function handleSpeedChange(event: Event) {
		const target = event.target as HTMLInputElement;
		setPlaybackSpeed(parseFloat(target.value));
	}

	// // Handler for play/pause button - Will be replaced/updated below
	// function togglePlayback() {
	// 	if (isPlaying) {
	// 		pausePlayback();
	// 		if (typeof window !== 'undefined' && window.speechSynthesis) {
	// 			window.speechSynthesis.cancel();
	// 		}
	// 	} else {
	// 		startPlayback();
	// 		// Playback logic will be triggered by a reactive statement listening to `isPlaying` (next step)
	// 	}
	// }

	let showStatsModal = false; // For stats modal on mobile
	let collectionPerfectToastShownThisSession = false;

	// Playback management variables
	let shuffledPlaybackdeck: FlashcardStudy[] = [];
	let currentPlaybackIndex = 0;
	let isPlaybackLoopRunning = false;

	async function startCardSequencePlayback() {
    console.log('[study/+page.svelte] startCardSequencePlayback() called.');
    console.log('[study/+page.svelte] Initial state: isPlaybackLoopRunning:', isPlaybackLoopRunning, 'isPlaying:', get(ttsSettings).isPlaying);

    if (isPlaybackLoopRunning) {
      console.log('[study/+page.svelte] Loop already running, exiting.');
      return;
    }
    isPlaybackLoopRunning = true;
    console.log('[study/+page.svelte] Set isPlaybackLoopRunning = true.');

    const currentCardsInStore = get(currentFlashcards);
    console.log('[study/+page.svelte] currentCardsInStore length:', currentCardsInStore?.length);

    if (!currentCardsInStore || currentCardsInStore.length === 0) {
      console.log('[study/+page.svelte] No cards in store. Stopping playback.');
      pausePlayback();
      isPlaybackLoopRunning = false;
      console.log('[study/+page.svelte] Set isPlaybackLoopRunning = false (no cards).');
      return;
    }

    shuffledPlaybackdeck = [...currentCardsInStore]
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
    console.log('[study/+page.svelte] shuffledPlaybackdeck created, length:', shuffledPlaybackdeck.length, 'First card ID:', shuffledPlaybackdeck[0]?.id);

    currentPlaybackIndex = 0;
    console.log('[study/+page.svelte] currentPlaybackIndex reset to 0.');

    while (currentPlaybackIndex < shuffledPlaybackdeck.length && get(ttsSettings).isPlaying) {
      console.log(`[study/+page.svelte] Loop iteration: currentPlaybackIndex = ${currentPlaybackIndex}, isPlaying = ${get(ttsSettings).isPlaying}`);
      const cardToPlay = shuffledPlaybackdeck[currentPlaybackIndex];
      console.log('[study/+page.svelte] cardToPlay ID:', cardToPlay?.id, 'Question:', cardToPlay?.question);

      const originalIndex = currentCardsInStore.findIndex(fc => fc.id === cardToPlay.id);
      console.log('[study/+page.svelte] originalIndex found:', originalIndex);

      if (originalIndex !== -1) {
        console.log('[study/+page.svelte] Setting currentIndex store to:', originalIndex);
        currentIndex.set(originalIndex);
      } else {
        console.error("[study/+page.svelte] Card from shuffled deck not found in original store. Skipping card ID:", cardToPlay?.id);
        currentPlaybackIndex++;
        continue;
      }

      console.log('[study/+page.svelte] Awaiting tick() for UI update after currentIndex.set.');
      await tick();
      console.log('[study/+page.svelte] tick() complete. Current card in store ID:', get(currentCard)?.id);

      // ---- START NEW SECTION FOR cardComponent READINESS ----
      let cardComponentReady = false;
      let retries = 0;
      const maxRetries = 10; // Try for up to 1 second (10 * 100ms)

      while(!cardComponentReady && retries < maxRetries && get(ttsSettings).isPlaying) {
        if (cardComponent && typeof cardComponent.speakCardDetails === 'function') {
          cardComponentReady = true;
          console.log(`[study/+page.svelte] cardComponent is ready after ${retries} retries.`);
        } else {
          retries++;
          console.warn(`[study/+page.svelte] cardComponent not ready or speakCardDetails not a function. Retry ${retries}/${maxRetries}. cardComponent:`, cardComponent);
          await new Promise(r => setTimeout(r, 100)); // Wait 100ms
          await tick(); // Allow Svelte to potentially update bindings
        }
      }

      if (!cardComponentReady) {
        console.error('[study/+page.svelte] Card component or speakCardDetails not available after retries. Stopping playback for this card/session.');
        // Option 1: Skip to next card if you want the loop to continue
        // currentPlaybackIndex++;
        // console.log('[study/+page.svelte] Skipping to next card.');
        // continue;
        // Option 2: Stop playback entirely
        pausePlayback();
        isPlaybackLoopRunning = false; // Ensure loop terminates
        console.log('[study/+page.svelte] Playback stopped due to cardComponent not being ready.');
        break; // Exit the while loop
      }
      // ---- END NEW SECTION FOR cardComponent READINESS ----

      // Now we are sure cardComponent and speakCardDetails are available if we haven't break/continued
      console.log('[study/+page.svelte] cardComponent defined?', !!cardComponent); // Should be true here
      if (cardComponent) {
          console.log('[study/+page.svelte] typeof cardComponent.speakCardDetails:', typeof cardComponent.speakCardDetails); // Should be function
      }


      if (get(currentCard)?.flipped) {
        console.log('[study/+page.svelte] Card ID', get(currentCard)?.id, 'is flipped, unflipping before speech.');
        flipCard(cardToPlay.id, false);
        console.log('[study/+page.svelte] Awaiting tick() after unflipping card ID', cardToPlay.id);
        await tick();
      }

      const speakParams = {
        frontText: cardToPlay.question,
        backText: cardToPlay.answer,
        exampleText: cardToPlay.example || '',
        pronunciationText: cardToPlay.pronunciation || '',
        lang: cardLanguage || get(ttsSettings).defaultLang,
        speed: get(ttsSettings).playbackSpeed,
        delay: 750
      };
      console.log('[study/+page.svelte] Calling cardComponent.speakCardDetails for card ID', cardToPlay.id, 'with params:', JSON.stringify(speakParams));
      try {
        await cardComponent.speakCardDetails(speakParams);
        console.log('[study/+page.svelte] cardComponent.speakCardDetails finished for card ID', cardToPlay.id);

        if (get(ttsSettings).isPlaying) {
          // ... (rest of the logic for flipping card, delay, incrementing index) ...
          console.log('[study/+page.svelte] Still playing. Flipping card ID', cardToPlay.id, 'to back.');
                  if (!get(currentCard)?.flipped) {
                      flipCard(cardToPlay.id, true);
                      console.log('[study/+page.svelte] Awaiting tick() after flipping card ID', cardToPlay.id, 'to back.');
                      await tick();
                  }
                  console.log('[study/+page.svelte] Waiting 1500ms before next card.');
                  await new Promise(r => setTimeout(r, 1500));
                  currentPlaybackIndex++;
                  console.log('[study/+page.svelte] Incremented currentPlaybackIndex to:', currentPlaybackIndex);
        } else {
          console.log('[study/+page.svelte] Playback was paused/stopped during/after speech for card ID', cardToPlay.id);
          break;
        }
      } catch (error) {
        console.error("[study/+page.svelte] Error during cardComponent.speakCardDetails for card ID", cardToPlay.id, ":", error);
        // Decide if to stop all playback or just skip the card
        // For now, let's log and try to continue with the next card if possible,
        // but if speakCardDetails itself is broken, this might not be a good idea.
        // A safer bet might be to pause playback.
        toast.error(`Error speaking card: ${cardToPlay.question.substring(0,20)}...`);
        // pausePlayback(); // Option: stop all playback
        // break;
        // Option: try to skip to next card
        currentPlaybackIndex++;
        console.log('[study/+page.svelte] Error speaking card, trying to skip to next card. New index:', currentPlaybackIndex);
        continue; // Try next card in the loop
      }
      // The original 'else' for cardComponent not being defined is now handled by the retry loop above.
    }

    console.log('[study/+page.svelte] Loop finished. currentPlaybackIndex:', currentPlaybackIndex, 'shuffledPlaybackdeck.length:', shuffledPlaybackdeck.length, 'isPlaying:', get(ttsSettings).isPlaying);
    if (get(ttsSettings).isPlaying && currentPlaybackIndex >= shuffledPlaybackdeck.length) {
      console.log('[study/+page.svelte] All cards played.');
      toast.success("Playback finished!");
      pausePlayback();
    } else if (!get(ttsSettings).isPlaying) {
      console.log('[study/+page.svelte] Loop terminated because isPlaying became false.');
    }
    isPlaybackLoopRunning = false;
    console.log('[study/+page.svelte] Set isPlaybackLoopRunning = false at end of function.');
  }

	// Reactive statement to start/stop playback loop
  $: if (get(ttsSettings).isPlaying && !isPlaybackLoopRunning) {
    console.log('[study/+page.svelte] Reactive trigger: isPlaying is true and loop not running. Calling startCardSequencePlayback().');
    startCardSequencePlayback();
  }

	// Modify togglePlayback to stop speech synthesis when pausing
  function togglePlayback() {
    console.log('[study/+page.svelte] togglePlayback called. Current isPlaying state (from store before toggle):', get(ttsSettings).isPlaying);
    if (get(ttsSettings).isPlaying) {
      pausePlayback();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        console.log('[study/+page.svelte] togglePlayback: Cancelling active speech synthesis.');
        window.speechSynthesis.cancel();
      }
    } else {
      startPlayback();
    }
  }

	let collections: Collection[] = []; // For selection dropdown
	let selectedCollectionId: string | undefined = undefined;
	let errorMessage: string | null = null;
	let isLoadingCollections = true;
	let isLoadingFlashcards = false; // Local loading state for fetching collection details
	let answerFeedback: 'correct' | 'incorrect' | null = null;
	let feedbackTimeout: number | null = null;
	$: if ($currentCard) {
		incrementTimesViewedForCurrentCard();
	}
	let showModal = false; // For session summary modal
	let filterActiveMessage: string | null = null; // For specific filter messages

	$: showModal = $sessionCompleted && !$isFilteredViewActive;

	// Update filterActiveMessage when relevant store values change
	$: {
		if ($isFilteredViewActive && $currentFlashcards.length === 0) {
			if ($isUnansweredOnly) {
				filterActiveMessage = 'All cards have been answered in this session.';
			} else {
				filterActiveMessage = 'No cards marked as failed in this session.';
			}
		} else {
			filterActiveMessage = null; // Clear message if cards are present or no filter active
		}
	}
	sessionCompleted.subscribe((value) => {
		console.log('🧠 sessionCompleted changed to:', value, 'at', new Date().toISOString());
	});

	sessionCompleted.subscribe((value) => {
		console.log('🧠 sessionCompleted changed to:', value, 'at', new Date().toISOString());
		console.trace(); // imprime quién cambió el valor
	});

	// Reactive statement for showing "Collection Perfect" toast
	$: if (
		$sessionCompleted &&
		$correctAnswers > 0 &&
		$incorrectAnswers === 0 &&
		!$isFilteredViewActive &&
		!$isReviewMode &&
		!collectionPerfectToastShownThisSession &&
		$activeCollection
	) {
		toast.success(
			`🏆 ¡Colección "${$activeCollection.name}" perfecta! Has dominado todas las tarjetas. ¡Bien hecho!`
		);
		collectionPerfectToastShownThisSession = true;
	}

	async function handleFilterUnansweredCards() {
		filterUnansweredCards(); // Store now sets isUnansweredOnly and isFilteredViewActive
		// TimesViewed update for the new $currentCard (if any) will be handled by its own $: block or navigation
	}

	async function handleFilterFailedCards() {
		filterFailedCards(); // Store now sets isFilteredViewActive and clears isUnansweredOnly
		// TimesViewed update for the new $currentCard (if any) will be handled by its own $: block or navigation
	}

	async function fetchCollections() {
		isLoadingCollections = true;
		errorMessage = null;
		try {
			const response = await fetch('/api/collections');
			if (!response.ok) {
				const errData = await response
					.json()
					.catch(() => ({ message: 'Failed to fetch collections' }));
				throw new Error(errData.message);
			}
			collections = await response.json();
		} catch (err: any) {
			errorMessage = err.message;
		} finally {
			isLoadingCollections = false;
		}
	}

	async function handleLoadCollectionForStudy() {
		if (!selectedCollectionId) {
			resetStudyState();
			return;
		}
		collectionPerfectToastShownThisSession = false; // Reset toast flag when loading a new collection
		isLoadingFlashcards = true;
		errorMessage = null;

		try {
			const response = await fetch(`/api/collections/${selectedCollectionId}`);
			if (!response.ok) {
				const errData = await response
					.json()
					.catch(() => ({ message: 'Failed to load flashcards for study' }));
				throw new Error(errData.message);
			}
			const fullCollection: CollectionWithFlashcards = await response.json();
			loadCollectionForStudy(fullCollection);
			await tick(); // 🔁 espera reactividad
			if ($currentCard) {
				incrementTimesViewedFor($currentCard.id);
				await updateTimesViewedAPI($currentCard.id, $currentCard.timesViewed + 1);
			}
		} catch (err: any) {
			errorMessage = err.message;
			resetStudyState(); // Reset store if loading fails
		} finally {
			isLoadingFlashcards = false;
		}
	}

	async function updateTimesViewedAPI(flashcardId: string, newTimesViewed: number) {
		try {
			const response = await fetch(`/api/flashcards/${flashcardId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timesViewed: newTimesViewed })
			});

			if (response.ok) {
				const updated = await response.json();
				currentFlashcards.update((cards) => {
					const idx = cards.findIndex((c) => c.id === flashcardId);
					if (idx !== -1) {
						cards[idx] = {
							...cards[idx], // 🟢 conserva flags locales como answeredInSession
							timesViewed: updated.timesViewed // 🟢 solo actualiza lo necesario
						};
					}
					return cards;
				});
			}
		} catch (err) {
			console.warn('Error syncing timesViewed:', err);
		}
	}

	async function handleMarkAnswer(isCorrect: boolean) {
		if (
			!$currentCard ||
			$currentCard.flipped ||
			($currentCard.answeredInSession && !$currentCard.failedInSession)
		) {
			console.log($currentCard);
			console.warn('Cannot mark answer: card not available or already answered.');
			return;
		}

		// feedback visual
		if (feedbackTimeout) {
			clearTimeout(feedbackTimeout);
			feedbackTimeout = null;
		}
		answerFeedback = isCorrect ? 'correct' : 'incorrect';

		// 👉 usar función del store
		markAnswer(isCorrect);

		// API update de estadísticas
		if (!get(isReviewMode)) {
			const cardToUpdate = { ...$currentCard };
			const newTimesCorrect = cardToUpdate.timesCorrect + (isCorrect ? 1 : 0);
			try {
				await fetch(`/api/flashcards/${cardToUpdate.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ timesCorrect: newTimesCorrect })
				});
			} catch (err) {
				console.warn('Error updating stats via API:', err);
			}
		}

		// fin de sesión si todas respondidas
		const allAnswered = get(currentFlashcards).every((fc) => fc.answeredInSession);
		const allCorrect = get(currentFlashcards).every(
			(fc) => fc.answeredInSession && !fc.failedInSession
		);

		if (allAnswered) {
			sessionCompleted.set(true);
			if (allCorrect) {
				awardBadge(BadgeId.COLLECTION_MASTERED);
			}
		}

		feedbackTimeout = window.setTimeout(() => {
			answerFeedback = null;
			feedbackTimeout = null;
		}, 750);
	}

	async function handleNavigate(direction: 'next' | 'prev') {
		if (direction === 'next') {
			nextCard();
		} else {
			previousCard();
		}
		// When card changes, update its timesViewed
		if ($currentCard) {
			// The currentCard is reactive, so it should be the new card after navigation
			// Ensure its flipped state is reset (handled by store's nextCard/previousCard)
			// And update timesViewed
			await updateTimesViewedAPI($currentCard.id, $currentCard.timesViewed + 1);
		}
	}

	async function handleShuffle() {
		shuffleFlashcards();
		if ($currentCard) {
			// Ensure the new current card (after shuffle) has its timesViewed updated.
			await updateTimesViewedAPI($currentCard.id, $currentCard.timesViewed + 1);
		}
	}

	async function handleShowAllCards() {
		showAllCards(); // Store now clears isUnansweredOnly and isFilteredViewActive
	}
	onMount(() => {
		const interval = setInterval(() => {
			saveProgressForCurrentCollection();
		}, 10000); // cada 10 segundos

		return () => clearInterval(interval); // limpieza al desmontar
	});
	onMount(async () => {
		// Make onMount async to await fetchCollections
		await fetchCollections(); // Wait for collections to be available for the dropdown
		console.log('🔁 currentCard after load:', $currentCard);
		// Read collectionId from URL after component mounts and page store is accessible
		const currentUrlParams = get(page).url.searchParams;
		const urlCollectionId = currentUrlParams.get('collectionId');

		if (urlCollectionId) {
			// Check if this collection ID exists in the fetched collections
			const collectionExists = collections.some((c) => c.id === urlCollectionId);
			if (collectionExists) {
				if (urlCollectionId !== selectedCollectionId) {
					selectedCollectionId = urlCollectionId; // This will also update the select dropdown's display
					console.log(`Loading collection for study: ${urlCollectionId}`);
					await handleLoadCollectionForStudy(); // Load the collection
				}
			} else {
				errorMessage = `Collection with ID ${urlCollectionId} not found. Please select one from the list.`;
				// Optionally clear selectedCollectionId or leave it to show in dropdown if it was an invalid direct link
				// selectedCollectionId = undefined; // This would reset the dropdown to '-- Select Collection --'
			}
		}
	});

	onDestroy(() => {
		// Check if a session is active and not completed before trying to save as 'incomplete'
		if (get(activeCollection) && !get(sessionCompleted)) {
			triggerIncompleteSessionSave('incomplete');
		}

		saveProgressForCurrentCollection(); // Save resumable progress
		resetStudyState(); // Clear study session state from memory
		if (feedbackTimeout) {
			// feedbackTimeout is a local variable in this component
			clearTimeout(feedbackTimeout);
		}
	});

	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (get(activeCollection) && !get(sessionCompleted)) {
				// Call triggerIncompleteSessionSave for 'abandoned' status
				triggerIncompleteSessionSave('abandoned');

				// Standard practice for beforeunload: some browsers require returnValue to be set.
				// Modern browsers often ignore custom messages for security reasons.
				// Setting it doesn't hurt.
				// event.preventDefault(); // Optional: some browsers might need this
				// event.returnValue = ''; // Optional: for older browser compatibility
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	async function handleStudyAgain() {
		const allAnswered = $correctAnswers + $incorrectAnswers === $totalFlashcards;
		const allCorrect = $correctAnswers === $totalFlashcards;
		console.log('handleStudyAgain called');
		console.log('allAnswered:', allAnswered);
		console.log('allCorrect:', allCorrect);

		isReviewMode.set(allAnswered && allCorrect);

		if ($activeCollection && selectedCollectionId && !isReviewMode) {
			// selectedCollectionId should still hold the ID of the current collection
			// handleLoadCollectionForStudy uses selectedCollectionId to load
			await handleLoadCollectionForStudy();
		} else if ($activeCollection && selectedCollectionId && isReviewMode) {
			// Fallback or error if no active collection to study again
			sessionCompleted.set(false); // Close modal
		} else {
			// If no collection is selected, reset the study state
			//resetStudyState();
			errorMessage = 'No collection selected. Please choose a collection to study.';
		}
		// loadCollectionForStudy (called by handleLoadCollectionForStudy) resets sessionCompleted in the store
	}

	function handleCloseSummary() {
		sessionCompleted.set(false);
		// User might want to select a new collection from the dropdown or navigate away.
		// Optionally, could reset selectedCollectionId to undefined if we want the dropdown to reset.
		// selectedCollectionId = undefined;
		// resetStudyState(); // Or fully reset if picking new means starting fresh from selection
	}

	async function handleToggleDifficult() {
		if (!$currentCard) return;

		const originalIsDifficult = $currentCard.isDifficult;
		const newIsDifficult = !originalIsDifficult;

		// 1. Optimistic UI update
		currentFlashcards.update((cards) => {
			const cardIdx = cards.findIndex((c) => c.id === $currentCard!.id);
			if (cardIdx !== -1) {
				cards[cardIdx] = { ...cards[cardIdx], isDifficult: newIsDifficult };
			}
			return cards;
		});

		// 2. API call to persist
		try {
			const response = await fetch(`/api/flashcards/${$currentCard.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isDifficult: newIsDifficult })
			});

			if (response.ok) {
				const updatedCardFromServer: PrismaFlashcard = await response.json();
				// Confirm with server's response (especially if other fields could change)
				currentFlashcards.update((cards) => {
					const cardIdx = cards.findIndex((c) => c.id === $currentCard!.id);
					if (cardIdx !== -1) {
						cards[cardIdx] = { ...cards[cardIdx], ...updatedCardFromServer };
					}
					return cards;
				});
				toast.success(`Card marked as ${newIsDifficult ? 'difficult' : 'not difficult'}.`);
			} else {
				// API call failed, revert optimistic update
				toast.error('Failed to update difficulty status.');
				currentFlashcards.update((cards) => {
					const cardIdx = cards.findIndex((c) => c.id === $currentCard!.id);
					if (cardIdx !== -1) {
						cards[cardIdx] = { ...cards[cardIdx], isDifficult: originalIsDifficult };
					}
					return cards;
				});
			}
		} catch (err) {
			toast.error('Error updating difficulty status.');
			console.error('Error in handleToggleDifficult:', err);
			// Revert optimistic update on network error
			currentFlashcards.update((cards) => {
				const cardIdx = cards.findIndex((c) => c.id === $currentCard!.id);
				if (cardIdx !== -1) {
					cards[cardIdx] = { ...cards[cardIdx], isDifficult: originalIsDifficult };
				}
				return cards;
			});
		}
	}

	function handleStudyAgainFullReset() {
		const id = $activeCollection?.id;
		if (!id) return;

		collectionPerfectToastShownThisSession = false; // Reset toast flag
		restartSessionForCurrentCollection(id);
		showModal = false;
	}

	function handleReviewOnlyFailed() {
		// This function is part of the modal actions.
		// It should directly call filterFailedCards now if that's the desired behavior.
		filterFailedCards(); // This will set isFilteredViewActive and !isUnansweredOnly
		showModal = false;
		// sessionCompleted is not touched here by design, as reviewing failed is part of an ongoing session.
	}

	function handleFreeMode() {
		showAllCards();
		showModal = false;
		// ❗️ No tocar sessionCompleted aquí
	}

	// Reactive variable for the autoPlay checkbox
	// let autoPlayTTS: boolean; // REMOVED
	// ttsSettings.subscribe((settings) => { // REMOVED Block
	// 	autoPlayTTS = settings.autoPlay;
	// });

	// function handleAutoPlayChange(event: Event) { // REMOVED
	// 	const target = event.target as HTMLInputElement;
	// 	updateTTSSettings({ autoPlay: target.checked });
	// }

	// Determine card language
	// TODO: This should ideally come from collection settings or individual card metadata
	// For now, we'll use a placeholder or the default from ttsSettings / Card.svelte.
	// If activeCollection had a 'lang' property, it would be:
	// $: cardLanguage = $activeCollection?.lang || $ttsSettings.defaultLang;
	// Using a fixed example for now, or relying on Card's default / ttsSettings.defaultLang
	let cardLanguage: string | undefined = undefined; // Let Card.svelte use its default or ttsSettings.defaultLang
	// $: cardLanguage = $activeCollection?.language; // Example if collection had a language field
	// $: if ($activeCollection && $activeCollection.lang) cardLanguage = $activeCollection.lang;
</script>

<!-- src/routes/study/+page.svelte -->

<svelte:head>
	<title>Study Mode - My Flashcards</title>
</svelte:head>

<div class="container mx-auto max-w-3xl p-4 md:p-6">
	<Modal
		bind:isOpen={showModal}
		title="Session Summary"
		message={`Collection: ${$activeCollection?.name || 'N/A'}\nTotal Cards: ${$totalFlashcards}\nCorrect: ${$correctAnswers}\nIncorrect: ${$incorrectAnswers}\nFinal Score: ${$currentScore}`}
		confirmText={$correctAnswers > 0 && $incorrectAnswers === 0
			? 'Repasar sin nuevos logros'
			: 'Study Again (Same Collection)'}
		disableConfirm={false}
		cancelText="Close"
		reviewText="Review"
		on:confirm={handleStudyAgainFullReset}
		on:review={handleReviewOnlyFailed}
		on:cancel={handleFreeMode}
	>
		{#if !$sessionCompleted && $correctAnswers > 0 && $incorrectAnswers === 0 && !$isFilteredViewActive && !$isReviewMode}
			<p class="mt-4 rounded-md bg-green-100 p-2 text-sm text-green-700">
				🏆 You're doing great! Aim for a perfect session!
			</p>
		{/if}
	</Modal>

	<Modal
		bind:isOpen={showStatsModal}
		title="Session Statistics"
		on:cancel={() => (showStatsModal = false)}
		showConfirmButton={false}
		cancelText="Close"
	>
		<div class="stats-modal-content">
			<SessionStats />
		</div>
	</Modal>

	<h1 class="mb-6 text-2xl font-bold text-gray-800 md:text-3xl">Study Mode</h1>

	{#if errorMessage}
		<div class="mb-6 border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
			<p class="font-bold">Error</p>
			<p>{errorMessage}</p>
		</div>
	{/if}

	{#if isLoadingCollections}
		<p class="text-gray-500">Loading collections...</p>
	{:else if collections.length === 0}
		<p class="text-gray-600">
			No collections available to study.
			<a href="/" class="text-blue-500 hover:underline">Manage collections.</a>
		</p>
	{:else if !$isFocusModeActive}
		<div class="mb-6">
			<label for="collectionSelect" class="mb-1 block text-sm font-medium text-gray-700">
				Choose a collection:
			</label>
			<select
				id="collectionSelect"
				bind:value={selectedCollectionId}
				on:change={handleLoadCollectionForStudy}
				class="block w-full appearance-none rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			>
				<option value={undefined} disabled>-- Select Collection --</option>
				{#each collections as collection (collection.id)}
					<option value={collection.id}>{collection.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Área principal de estudio -->
	{#if isLoadingFlashcards}
		<p class="text-gray-500">Loading flashcards...</p>
	{:else if selectedCollectionId && $activeCollection && $totalFlashcards > 0}
		<div
			class="study-area rounded-lg bg-white p-3 shadow-xl sm:p-4 md:p-6 lg:p-8"
			class:min-h-[calc(100vh-12rem)]={$isFocusModeActive}
			class:flex={$isFocusModeActive}
			class:flex-col={$isFocusModeActive}
			class:justify-center={$isFocusModeActive}
		>
			{#if $currentCard}
				<!-- Contenedor de la tarjeta -->
				<div class="relative flex flex-col items-center justify-center gap-4">
					<!-- TTS toggle REMOVED -->

					<!-- Tarjeta principal -->
					<!-- Playback Controls -->
					<div class="mt-4 flex items-center gap-4 rounded-md bg-gray-100 p-3 shadow">
						<button
							on:click={togglePlayback}
							class="rounded px-4 py-2 text-white flex items-center"
							class:bg-blue-500={!isPlaying}
							class:hover:bg-blue-600={!isPlaying}
							class:bg-red-500={isPlaying}
							class:hover:bg-red-600={isPlaying}
							title={isPlaying ? 'Pause card playback' : 'Play cards automatically'}
						>
							{isPlaying ? 'Pause' : 'Play'}
							<svg class="ml-2 inline-block h-5 w-5 fill-current" viewBox="0 0 20 20">
								{#if isPlaying}
									<!-- Pause Icon -->
									<path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/>
								{:else}
									<!-- Play Icon -->
									<path d="M4 4l12 6-12 6z"/>
								{/if}
							</svg>
						</button>
						<div class="flex items-center gap-2">
							<label for="playbackSpeedSlider" class="text-sm text-gray-700">Speed:</label>
							<input
								type="range"
								id="playbackSpeedSlider"
								min="0.5"
								max="2"
								step="0.1"
								bind:value={playbackSpeed}
								on:input={handleSpeedChange} /* Changed from on:change to on:input */
								class="w-24 cursor-pointer"
								title={`Playback speed: ${playbackSpeed}x`}
							/>
							<span class="text-sm text-gray-600 w-8 text-right">{playbackSpeed.toFixed(1)}x</span>
						</div>
					</div>

					<Card
						bind:this={cardComponent}
						front={$currentCard.question}
						back={$currentCard.answer}
						imageUrl={$currentCard.imageUrl}
						pronunciation={$currentCard.pronunciation}
						example={$currentCard.example}
						flipped={$currentCard.flipped || false}
						cardLang={cardLanguage} /* Ensure cardLanguage is defined in the scope */
						on:toggle={(e) => flipCard($currentCard!.id, e.detail.flipped)}
					/>

					<!-- Estadísticas de la tarjeta -->
					<div class="text-sm text-gray-500">
						Viewed: {$currentCard.timesViewed}, Correct: {$currentCard.timesCorrect}
					</div>
				</div>

				<!-- Botones de respuesta -->
				<div class="mt-6 flex w-full flex-wrap justify-center gap-4">
					<button
						on:click={() => handleMarkAnswer(true)}
						class="rounded bg-green-500 px-4 py-2 text-white">Correct</button
					>
					<button
						on:click={() => handleMarkAnswer(false)}
						class="rounded bg-red-500 px-4 py-2 text-white">Incorrect</button
					>
				</div>

				<!-- Navegación -->
				<div class="mt-4 flex w-full justify-between">
					<button on:click={() => handleNavigate('prev')} class="text-blue-500 hover:underline"
						>Previous</button
					>
					<button on:click={() => handleNavigate('next')} class="text-blue-500 hover:underline"
						>Next</button
					>
				</div>
			{:else if $totalFlashcards > 0}
				<p class="py-10 text-center text-red-500">
					Error: Card data seems to be in an inconsistent state. Try reloading or selecting another
					collection.
				</p>
			{:else if !$isFocusModeActive && !selectedCollectionId}
				<p class="py-10 text-center text-gray-500">
					Select a collection to start studying or manage your cards.
				</p>
			{:else if !$isFocusModeActive && filterActiveMessage}
				<p class="py-10 text-center text-yellow-600">
					{filterActiveMessage}
				</p>
			{/if}
		</div>
	{:else if selectedCollectionId && !isLoadingFlashcards && $totalFlashcards === 0}
		{#if !$isFocusModeActive}
			<p class="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-gray-600">
				This collection is empty or no flashcards were loaded.
				<a
					href="/admin/new?collectionId={selectedCollectionId}"
					class="text-blue-500 hover:underline"
				>
					Add flashcards to this collection.
				</a>
			</p>
		{/if}
	{/if}

	{#if !$isFocusModeActive}
		<div class="mt-2 text-center">
			<a href="/" class="text-indigo-600 hover:text-indigo-800 hover:underline">
				Back to Collections List
			</a>
		</div>
	{/if}
</div>

<style>
	select {
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
		background-position: right 0.5rem center;
		background-repeat: no-repeat;
		background-size: 1.5em 1.5em;
		padding-right: 2.5rem;
	}
</style>
