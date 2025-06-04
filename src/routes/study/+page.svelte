<!-- src/routes/study/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store'; // Added get
	import { page } from '$app/stores'; // Added page store
	import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
	import Card from '$lib/components/Card.svelte'; // Adjust path as necessary
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
		markAnswer as markAnswerStore,
		nextCard,
		previousCard,
		shuffleFlashcards,
		resetStudyState,
		isFilteredViewActive, // Import new store state
		filterFailedCards, // Import new actions
		showAllCards,
		saveProgressForCurrentCollection // Import saveProgressForCurrentCollection
	} from '$lib/stores/studyStore';
	import type { CollectionWithFlashcards, FlashcardStudy } from '$lib/stores/studyStore';
	import Modal from '$lib/components/Modal.svelte'; // Import Modal
	import { toast } from '$lib/toastStore'; // Import toast

	let collections: Collection[] = []; // For selection dropdown
	let selectedCollectionId: string | undefined = undefined;
	let errorMessage: string | null = null;
	let isLoadingCollections = true;
	let isLoadingFlashcards = false; // Local loading state for fetching collection details
	let answerFeedback: 'correct' | 'incorrect' | null = null;
	let feedbackTimeout: number | null = null;

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
			loadCollectionForStudy(fullCollection); // This will process and set flashcards in the store

			// If there are flashcards, update timesViewed for the first card
			if ($currentCard) {
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
		// Optimistically update the store first
		currentFlashcards.update((cards) => {
			const cardIdx = cards.findIndex((fc) => fc.id === flashcardId);
			if (cardIdx !== -1) {
				// Ensure we're creating a new object for reactivity if just changing a property
				cards[cardIdx] = { ...cards[cardIdx], timesViewed: newTimesViewed };
			}
			return cards;
		});

		try {
			const response = await fetch(`/api/flashcards/${flashcardId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timesViewed: newTimesViewed })
			});

			if (response.ok) {
				const updatedCardFromServer: PrismaFlashcard = await response.json();
				// Confirm with server's response.
				// If server's timesViewed is different, it takes precedence.
				currentFlashcards.update((cards) => {
					const cardIdx = cards.findIndex((fc) => fc.id === flashcardId);
					if (cardIdx !== -1) {
						// Merge server data, ensuring our optimistic update is overwritten if server disagrees
						// (though for timesViewed, it should match newTimesViewed if API is simple set)
						cards[cardIdx] = { ...cards[cardIdx], ...updatedCardFromServer };
					}
					return cards;
				});
			} else {
				// API call failed, revert optimistic update
				console.warn('API failed to update timesViewed for card:', flashcardId, '. Reverting optimistic update.');
				currentFlashcards.update((cards) => {
					const cardIdx = cards.findIndex((fc) => fc.id === flashcardId);
					if (cardIdx !== -1) {
						// Revert to newTimesViewed - 1 (the value before optimistic increment)
						cards[cardIdx] = { ...cards[cardIdx], timesViewed: newTimesViewed - 1 };
					}
					return cards;
				});
				// Optionally, set an errorMessage for the user
				// errorMessage = `Failed to sync view count for card. Please try again.`;
			}
		} catch (err) {
			console.warn('Failed to update timesViewed via API:', err, '. Reverting optimistic update.');
			// Network or other error, revert optimistic update
			currentFlashcards.update((cards) => {
				const cardIdx = cards.findIndex((fc) => fc.id === flashcardId);
				if (cardIdx !== -1) {
					cards[cardIdx] = { ...cards[cardIdx], timesViewed: newTimesViewed - 1 };
				}
				return cards;
			});
			// Optionally, set an errorMessage for the user
			// errorMessage = `Network error syncing view count. Please check your connection.`;
		}
	}

	async function handleMarkAnswer(isCorrect: boolean) {
		if (!$currentCard) return;
		if ($currentCard.flipped) return; // Only allow marking if card is not flipped (defensive)

		// Clear previous timeout if any
		if (feedbackTimeout) {
			clearTimeout(feedbackTimeout);
			feedbackTimeout = null;
		}

		answerFeedback = isCorrect ? 'correct' : 'incorrect';

		markAnswerStore(isCorrect); // This updates store counts, score, and potentially session/badge logic

		// API call to update backend
		const cardToUpdate = { ...$currentCard }; // Capture its current state for API call, ensure it's the one being marked
		const newTimesCorrect = cardToUpdate.timesCorrect + (isCorrect ? 1 : 0);
		// Assuming timesViewed is already handled or not incremented on marking answer.
		// If it should be, add: const newTimesViewed = cardToUpdate.timesViewed + 1;

		try {
			const response = await fetch(`/api/flashcards/${cardToUpdate.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timesCorrect: newTimesCorrect
					// timesViewed: newTimesViewed // If applicable
				})
			});
			if (response.ok) {
				const updatedCardFromServer: PrismaFlashcard = await response.json();
				// Update the specific card in the store with latest from server
				currentFlashcards.update((cards) => {
					const cardIdx = cards.findIndex((fc) => fc.id === cardToUpdate.id);
					if (cardIdx !== -1) {
						cards[cardIdx] = { ...cards[cardIdx], ...updatedCardFromServer };
					}
					return cards;
				});
			} else {
				const errData = await response.json().catch(() => ({ message: 'Failed to update stats' }));
				console.warn(
					'API failed to update correct/incorrect stats for card:',
					cardToUpdate.id,
					errData.message
				);
				// Optionally revert store counts if API fails, or notify user
			}
		} catch (err: any) {
			console.warn('Error updating correct/incorrect stats via API:', err.message);
		}
		// Consider if auto-navigation is desired here, e.g., nextCard();

		// Set timeout to clear feedback
		feedbackTimeout = window.setTimeout(() => {
			answerFeedback = null;
			feedbackTimeout = null; // Clear the stored timeout ID
		}, 750); // 750ms duration for feedback

		// Optional: Auto-flip the card after marking and feedback
		// if ($currentCard && $currentCard.id === cardToUpdate.id) { // Ensure current card is still the one we marked
		//   flipCard($currentCard.id, true);
		// }
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

	async function handleFilterFailedCards() {
		filterFailedCards(); // This action might change currentFlashcards and currentIndex
		if ($currentCard) {
			// If filter results in a card being shown, update its timesViewed
			await updateTimesViewedAPI($currentCard.id, $currentCard.timesViewed + 1);
		}
	}

	async function handleShowAllCards() {
		showAllCards(); // This action will change currentFlashcards and currentIndex
		if ($currentCard) {
			// Update timesViewed for the new current card shown from the full list
			await updateTimesViewedAPI($currentCard.id, $currentCard.timesViewed + 1);
		}
	}

	onMount(async () => { // Make onMount async to await fetchCollections
		await fetchCollections(); // Wait for collections to be available for the dropdown

		// Read collectionId from URL after component mounts and page store is accessible
		const currentUrlParams = get($page).url.searchParams;
		const urlCollectionId = currentUrlParams.get('collectionId');

		if (urlCollectionId) {
			// Check if this collection ID exists in the fetched collections
			const collectionExists = collections.some(c => c.id === urlCollectionId);
			if (collectionExists) {
				if (urlCollectionId !== selectedCollectionId) {
					selectedCollectionId = urlCollectionId; // This will also update the select dropdown's display
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
		saveProgressForCurrentCollection(); // Save progress before resetting state
		resetStudyState(); // Clear study session state from memory
		if (feedbackTimeout) {
			clearTimeout(feedbackTimeout);
		}
	});

	async function handleStudyAgain() {
		if ($activeCollection && selectedCollectionId) {
			// selectedCollectionId should still hold the ID of the current collection
			// handleLoadCollectionForStudy uses selectedCollectionId to load
			await handleLoadCollectionForStudy();
		} else {
			// Fallback or error if no active collection to study again
			sessionCompleted.set(false); // Close modal
			errorMessage = "Could not restart session: No active collection found.";
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
		currentFlashcards.update(cards => {
			const cardIdx = cards.findIndex(c => c.id === $currentCard!.id);
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
				currentFlashcards.update(cards => {
					const cardIdx = cards.findIndex(c => c.id === $currentCard!.id);
					if (cardIdx !== -1) {
						cards[cardIdx] = { ...cards[cardIdx], ...updatedCardFromServer };
					}
					return cards;
				});
				toast.success(`Card marked as ${newIsDifficult ? 'difficult' : 'not difficult'}.`);
			} else {
				// API call failed, revert optimistic update
				toast.error('Failed to update difficulty status.');
				currentFlashcards.update(cards => {
					const cardIdx = cards.findIndex(c => c.id === $currentCard!.id);
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
			currentFlashcards.update(cards => {
				const cardIdx = cards.findIndex(c => c.id === $currentCard!.id);
				if (cardIdx !== -1) {
					cards[cardIdx] = { ...cards[cardIdx], isDifficult: originalIsDifficult };
				}
				return cards;
			});
		}
	}
</script>

<svelte:head>
	<title>Study Mode - My Flashcards</title>
</svelte:head>

<div class="container mx-auto max-w-3xl p-4 md:p-6">
	<Modal
		bind:isOpen={$sessionCompleted}
		title="Session Summary"
		message={`Collection: ${$activeCollection?.name || 'N/A'}\nTotal Cards: ${$totalFlashcards}\nCorrect: ${$correctAnswers}\nIncorrect: ${$incorrectAnswers}\nFinal Score: ${$currentScore}`}
		confirmText="Study Again (Same Collection)"
		cancelText="Close / Pick New"
		on:confirm={handleStudyAgain}
		on:cancel={handleCloseSummary}
	/>

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
			<div class="mb-4 flex items-center justify-between">
				<p class="text-sm text-gray-600">
					Card {$currentIndex + 1} of {$totalFlashcards}
					{#if $activeCollection.name}in "{$activeCollection.name}"{/if}
					{#if $isFilteredViewActive} (Failed Only){/if}
				</p>
				<div class="flex space-x-2">
					<button
						on:click={handleShuffle}
						class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
					>
						Shuffle
					</button>
					{#if $isFilteredViewActive}
						<button
							on:click={handleShowAllCards}
							class="rounded-md border border-blue-300 bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
						>
							Show All Cards
						</button>
					{:else}
						<button
							on:click={handleFilterFailedCards}
							disabled={!$currentFlashcards.some((card) => card.failedInSession)}
							class="rounded-md border border-orange-300 bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Study Failed Only
						</button>
					{/if}
				</div>
			</div>

			<div class="mb-4 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
				<div
					class="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
					style="width: {$progressPercentage}%"
				></div>
			</div>


			{#if $currentCard}
				<div
					class="card-wrapper mx-auto transition-all duration-300 ease-in-out"
					class:border-green-500={answerFeedback === 'correct'}
					class:border-red-500={answerFeedback === 'incorrect'}
					class:shadow-green-xl={answerFeedback === 'correct'}
					class:shadow-red-xl={answerFeedback === 'incorrect'}
					class:border-4={answerFeedback !== null}
					style="max-width: 500px; min-height: 300px;"
				>
					<Card
						front={$currentCard.question}
						back={$currentCard.answer}
						imageUrl={$currentCard.imageUrl}
						flipped={$currentCard.flipped || false}
						on:toggle={(e) => flipCard($currentCard!.id, e.detail.flipped)}
					/>
				</div>
				<div class="mt-3 flex items-center justify-center text-xs text-gray-500">
					<p class="mr-4">Viewed: {$currentCard.timesViewed}, Correct: {$currentCard.timesCorrect}</p>
					<button
						on:click={handleToggleDifficult}
						title={$currentCard.isDifficult ? 'Mark as not difficult' : 'Mark as difficult'}
						class:text-yellow-500={$currentCard.isDifficult}
						class:hover:text-yellow-600={$currentCard.isDifficult}
						class:text-gray-400={!$currentCard.isDifficult}
						class:hover:text-gray-600={!$currentCard.isDifficult}
						class="p-1 rounded-full transition-colors"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
							<path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>
			{:else}
				<p class="py-10 text-center text-red-500">
					Error: Current card data is not available or collection is empty.
				</p>
			{/if}

			<div class="my-4 text-center">
				<p class="text-xl font-bold text-indigo-600 mb-1">Score: {$currentScore}</p>
				<p class="text-md">{$correctAnswers} Correct, {$incorrectAnswers} Incorrect</p>
			</div>

			<div
				class="mt-8 flex flex-col items-center justify-between space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0"
			>
				<button
					on:click={() => handleNavigate('prev')}
					disabled={$totalFlashcards <= 1}
					class="w-full rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
				>
					Previous
				</button>
				<div class="flex space-x-3">
					<button
						on:click={() => handleMarkAnswer(false)}
						disabled={!$currentCard || $currentCard.flipped}
						class="rounded-md bg-red-500 px-4 py-3 text-sm text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Incorrect
					</button>
					<button
						on:click={() => handleMarkAnswer(true)}
						disabled={!$currentCard || $currentCard.flipped}
						class="rounded-md bg-green-500 px-4 py-3 text-sm text-white transition-colors hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Correct
					</button>
				</div>
				<button
					on:click={() => handleNavigate('next')}
					disabled={$totalFlashcards <= 1}
					class="w-full rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
				>
					Next
				</button>
			</div>
		</div>
	{:else if selectedCollectionId && !isLoadingFlashcards && $totalFlashcards === 0}
		<p class="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-gray-600">
			This collection is empty or no flashcards were loaded.
			<a href="/admin/new?collectionId={selectedCollectionId}" class="text-blue-500 hover:underline"
				>Add flashcards to this collection.</a
			>
		</p>
	{/if}

	<div class="mt-8 text-center">
		<a href="/" class="text-indigo-600 transition-colors hover:text-indigo-800 hover:underline"
			>Back to Collections List</a
		>
	</div>
</div>

<style>
	/* Ensure select dropdown arrow is visible with tailwind */
	select {
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
		background-position: right 0.5rem center;
		background-repeat: no-repeat;
		background-size: 1.5em 1.5em;
		padding-right: 2.5rem; /* Make space for arrow */
	}
</style>
