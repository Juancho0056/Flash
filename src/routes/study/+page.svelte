<!-- src/routes/study/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store'; // Added get
	import { page } from '$app/stores'; // Added page store
	import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
	import Card from '$lib/components/Card.svelte'; // Adjust path as necessary
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
		restartSessionForCurrentCollection
	} from '$lib/stores/studyStore';
	import type { CollectionWithFlashcards, FlashcardStudy } from '$lib/stores/studyStore';
	import Modal from '$lib/components/Modal.svelte'; // Import Modal
	import { toast } from '$lib/toastStore'; // Import toast
	import { awardBadge, BadgeId } from '$lib/services/badgeService';
	import { afterUpdate } from 'svelte'; // Import afterUpdate for reactive updates
	import { ttsSettings, updateTTSSettings } from '$lib/stores/ttsStore'; // Import TTS store and updater

	let hasShownPerfectBadgeMessage = false;
	let showBadgeMessage = false;

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

	afterUpdate(async () => {
		if (hasShownPerfectBadgeMessage || showBadgeMessage) return;

		await tick(); // Espera que todo se reactive

		const completed = get(sessionCompleted);
		const cards = get(currentFlashcards);

		if (!completed || cards.length === 0) return;

		const allCorrect = cards.every((fc) => fc.answeredInSession && !fc.failedInSession);

		if (allCorrect) {
			console.log('🏅 Mostrando mensaje de logro por colección perfecta');
			showBadgeMessage = true;
			hasShownPerfectBadgeMessage = true;
		}
	});

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
		if (feedbackTimeout) { // feedbackTimeout is a local variable in this component
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

	$: allBadgesUnlocked = $sessionCompleted && $correctAnswers > 0 && $incorrectAnswers === 0;

	// Reactive variable for the autoPlay checkbox
	let autoPlayTTS: boolean;
	ttsSettings.subscribe((settings) => {
		autoPlayTTS = settings.autoPlay;
	});

	function handleAutoPlayChange(event: Event) {
		const target = event.target as HTMLInputElement;
		updateTTSSettings({ autoPlay: target.checked });
	}

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
		{#if allBadgesUnlocked}
			<p class="mt-4 rounded-md bg-green-100 p-2 text-sm text-green-700">
				🏆 Has completado esta colección perfectamente y ya obtuviste todos los logros disponibles.
				¡Bien hecho!
			</p>
		{/if}
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
			No collections available to study. <a href="/" class="text-blue-500 hover:underline"
				>Manage collections.</a
			>
		</p>
	{:else}
		<div class="mb-6">
			<label for="collectionSelect" class="mb-1 block text-sm font-medium text-gray-700"
				>Choose a collection:</label
			>
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

	{#if isLoadingFlashcards}
		<p class="text-gray-500">Loading flashcards...</p>
	{:else if selectedCollectionId && $activeCollection && $totalFlashcards > 0}
		<div class="study-area rounded-lg bg-white p-6 shadow-xl md:p-8">
			<SessionStats />

			<div class="my-4 flex items-center justify-end">
				<label for="autoPlayToggle" class="mr-2 text-sm text-gray-700">Auto-speak cards:</label>
				<input
					type="checkbox"
					id="autoPlayToggle"
					bind:checked={autoPlayTTS}
					on:change={handleAutoPlayChange}
					class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
				/>
			</div>

			{#if allBadgesUnlocked}
				<p class="mt-4 rounded-md bg-green-100 p-2 text-sm text-green-700">
					🏆 Has completado esta colección perfectamente y ya obtuviste todos los logros
					disponibles. ¡Bien hecho!
				</p>
			{/if}

			<div class="mb-4 flex items-center justify-between pt-4">
				<p class="text-sm text-gray-600">
					Card {$currentIndex + 1} of {$totalFlashcards}
					{#if $activeCollection.name}in "{$activeCollection.name}"{/if}
					{#if $isUnansweredOnly}
						(Unanswered Only)
					{:else if $isFilteredViewActive}
						(Failed Only)
					{/if}
				</p>

				<div class="flex space-x-2">
					<button
						on:click={handleShuffle}
						class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
					>
						Shuffle
					</button>

					{#if $isFilteredViewActive}
						<button
							on:click={handleShowAllCards}
							class="rounded-md border border-blue-300 bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
						>
							Show All Cards
						</button>
					{:else}
						<button
							on:click={handleFilterFailedCards}
							disabled={!$currentFlashcards.some((card) => card.failedInSession)}
							class="rounded-md border border-orange-300 bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 disabled:opacity-50"
						>
							Study Failed Only
						</button>
						<button
							on:click={handleFilterUnansweredCards}
							class="rounded-md border border-purple-300 bg-purple-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600 focus:ring-2 focus:ring-purple-400 focus:ring-offset-1"
						>
							Unanswered Only
						</button>
					{/if}
				</div>
			</div>

			<div class="mb-4 h-2.5 w-full rounded-full bg-gray-200">
				<div
					class="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
					style="width: {$progressPercentage}%"
				></div>
			</div>

			{#if $currentCard}
				{#if $currentCard}
					<div
						class="card-wrapper mx-auto flex flex-grow items-center justify-center transition-all duration-300 ease-in-out"
						class:border-green-500={answerFeedback === 'correct'}
						class:border-red-500={answerFeedback === 'incorrect'}
						class:shadow-green-xl={answerFeedback === 'correct'}
						class:shadow-red-xl={answerFeedback === 'incorrect'}
						class:border-4={answerFeedback !== null}
						style="max-width: 500px; min-height: 260px;"
					>
						<Card
							front={$currentCard.question}
							back={$currentCard.answer}
							imageUrl={$currentCard.imageUrl}
							pronunciation={$currentCard.pronunciation}
							example={$currentCard.example}
							flipped={$currentCard.flipped || false}
							cardLang={cardLanguage}
							on:toggle={(e) => flipCard($currentCard!.id, e.detail.flipped)}
						/>
					</div>

					<div class="flex items-center justify-center text-xs text-gray-500">
						<p class="mr-4">
							Viewed: {$currentCard.timesViewed}, Correct: {$currentCard.timesCorrect}
						</p>
						<button
							on:click={handleToggleDifficult}
							title={$currentCard.isDifficult ? 'Mark as not difficult' : 'Mark as difficult'}
							class:text-yellow-500={$currentCard.isDifficult}
							class:hover:text-yellow-600={$currentCard.isDifficult}
							class:text-gray-400={!$currentCard.isDifficult}
							class:hover:text-gray-600={!$currentCard.isDifficult}
							class="rounded-full p-1 transition-colors"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-5 w-5"
							>
								<path
									fill-rule="evenodd"
									d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>

					<!-- Score y navegación -->
					<div class="my-4 text-center">
						<p class="mb-1 text-xl font-bold text-indigo-600">Score: {$currentScore}</p>
						<p class="text-md">{$correctAnswers} Correct, {$incorrectAnswers} Incorrect</p>
					</div>

					<div
						class="mt-8 flex flex-col items-center justify-between space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3"
					>
						<button
							on:click={() => handleNavigate('prev')}
							disabled={$totalFlashcards <= 1}
							class="w-full rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						>
							Previous
						</button>
						<div class="flex space-x-3">
							<button
								on:click={() => handleMarkAnswer(false)}
								disabled={!$currentCard ||
									$currentCard.flipped ||
									($currentCard.answeredInSession && !$currentCard.failedInSession)}
								class="rounded-md bg-red-500 px-4 py-3 text-sm text-white transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								Incorrect
							</button>
							<button
								on:click={() => handleMarkAnswer(true)}
								disabled={!$currentCard ||
									$currentCard.flipped ||
									($currentCard.answeredInSession && !$currentCard.failedInSession)}
								class="rounded-md bg-green-500 px-4 py-3 text-sm text-white transition-colors hover:bg-green-600 focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								Correct
							</button>
						</div>
						<button
							on:click={() => handleNavigate('next')}
							disabled={$totalFlashcards <= 1}
							class="w-full rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						>
							Next
						</button>
					</div>
				{/if}
				<!-- Ya corregido como en la respuesta anterior -->
			{:else if !$currentCard && $totalFlashcards > 0}
				<p class="py-10 text-center text-red-500">
					Error: Card data seems to be in an inconsistent state. Try reloading or selecting another
					collection.
				</p>
			{:else if !$currentCard}
				<p class="py-10 text-center text-gray-500">
					Select a collection to start studying or manage your cards.
				</p>
			{:else}
				<p class="py-10 text-center text-yellow-600">
					{filterActiveMessage}
				</p>
			{/if}
		</div>
	{:else if selectedCollectionId && !isLoadingFlashcards && $totalFlashcards === 0}
		<p class="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-gray-600">
			This collection is empty or no flashcards were loaded.
			<a href="/admin/new?collectionId={selectedCollectionId}" class="text-blue-500 hover:underline"
				>Add flashcards to this collection.</a
			>
		</p>
	{/if}

	<div class="mt-2 text-center">
		<a href="/" class="text-indigo-600 hover:text-indigo-800 hover:underline"
			>Back to Collections List</a
		>
	</div>
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
