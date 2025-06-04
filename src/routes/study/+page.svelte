<!-- src/routes/study/index.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
	import Card from '$lib/components/Card.svelte'; // Adjust path as necessary

	interface FlashcardStudy extends PrismaFlashcard {
		flipped?: boolean; // UI state for the card component
	}

	interface CollectionWithFlashcards extends Collection {
		flashcards: FlashcardStudy[];
	}

	let collections: Collection[] = []; // Just names and IDs for selection
	let selectedCollectionId: string | undefined = undefined;
	let studyCollection: CollectionWithFlashcards | null = null;
	let currentCardIndex = 0;

	let errorMessage: string | null = null;
	let isLoadingCollections = true;
	let isLoadingFlashcards = false;

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

	async function loadFlashcardsForStudy() {
		if (!selectedCollectionId) {
			studyCollection = null;
			currentCardIndex = 0;
			return;
		}
		isLoadingFlashcards = true;
		errorMessage = null;
		studyCollection = null; // Clear previous collection data
		currentCardIndex = 0;

		try {
			const response = await fetch(`/api/collections/${selectedCollectionId}`);
			if (!response.ok) {
				const errData = await response
					.json()
					.catch(() => ({ message: 'Failed to load flashcards for study' }));
				throw new Error(errData.message);
			}
			const fullCollection: CollectionWithFlashcards = await response.json();

			if (fullCollection && fullCollection.flashcards) {
				studyCollection = {
					...fullCollection,
					flashcards: fullCollection.flashcards.map((fc) => ({
						...fc,
						flipped: false,
						timesViewed: fc.timesViewed || 0,
						timesCorrect: fc.timesCorrect || 0
					}))
				};
				if (studyCollection.flashcards.length > 0) {
					await updateTimesViewedAPI(
						studyCollection.flashcards[0].id,
						studyCollection.flashcards[0].timesViewed + 1
					);
				}
			} else {
				studyCollection = { ...fullCollection, flashcards: [] }; // Ensure flashcards is an array
			}
		} catch (err: any) {
			errorMessage = err.message;
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
				const updatedCard = await response.json();
				if (studyCollection) {
					const cardIdx = studyCollection.flashcards.findIndex((fc) => fc.id === flashcardId);
					if (cardIdx !== -1) {
						studyCollection.flashcards[cardIdx].timesViewed = updatedCard.timesViewed;
						studyCollection.flashcards = [...studyCollection.flashcards];
					}
				}
			}
		} catch (err) {
			console.warn('Failed to update timesViewed via API:', err);
		}
	}

	async function updateCorrectIncorrectAPI(isCorrect: boolean) {
		if (!studyCollection || !studyCollection.flashcards[currentCardIndex]) return;

		const card = studyCollection.flashcards[currentCardIndex];
		const newTimesCorrect = card.timesCorrect + (isCorrect ? 1 : 0);
		// timesViewed is handled when card is first shown or if we want to increment it here too
		// const newTimesViewed = card.timesViewed + 1; // if counting this interaction as a view

		try {
			const response = await fetch(`/api/flashcards/${card.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timesCorrect: newTimesCorrect /*, timesViewed: newTimesViewed */ })
			});
			if (response.ok) {
				const updatedCardFromServer: PrismaFlashcard = await response.json();
				studyCollection.flashcards[currentCardIndex] = {
					...card, // keep flipped state
					...updatedCardFromServer // update with server data
				};
				studyCollection.flashcards = [...studyCollection.flashcards];
			} else {
				const errData = await response.json().catch(() => ({ message: 'Failed to update stats' }));
				console.warn(
					'Failed to update correct/incorrect stats for card:',
					card.id,
					errData.message
				);
			}
		} catch (err: any) {
			console.warn('Error updating correct/incorrect stats:', err.message);
		}
		// navigateCard(1); // Optionally auto-navigate after marking
	}

	function navigateCard(direction: 1 | -1) {
		if (!studyCollection || studyCollection.flashcards.length === 0) return;

		let newIndex = currentCardIndex + direction;
		if (newIndex >= studyCollection.flashcards.length) newIndex = 0;
		else if (newIndex < 0) newIndex = studyCollection.flashcards.length - 1;

		currentCardIndex = newIndex;

		// Reset flipped state for the new card and update timesViewed
		const newCard = studyCollection.flashcards[currentCardIndex];
		newCard.flipped = false; // Always show front first on new card
		updateTimesViewedAPI(newCard.id, newCard.timesViewed + 1); // Increment and update via API

		studyCollection.flashcards = [...studyCollection.flashcards]; // Trigger Svelte reactivity
	}

	function handleCardToggle(event: CustomEvent<{ flipped: boolean }>, cardId: string) {
		if (studyCollection) {
			const card = studyCollection.flashcards.find((c) => c.id === cardId);
			if (card) {
				card.flipped = event.detail.flipped;
				studyCollection.flashcards = [...studyCollection.flashcards];
			}
		}
	}

	onMount(() => {
		fetchCollections();
	});
</script>

<svelte:head>
	<title>Study Mode - My Flashcards</title>
</svelte:head>

<div class="container mx-auto max-w-3xl p-4 md:p-6">
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
				on:change={loadFlashcardsForStudy}
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
	{:else if selectedCollectionId && studyCollection && studyCollection.flashcards.length > 0}
		{@const currentFlashcard = studyCollection.flashcards[currentCardIndex]}
		<div class="study-area rounded-lg bg-white p-6 shadow-xl md:p-8">
			<p class="mb-4 text-sm text-gray-600">
				Card {currentCardIndex + 1} of {studyCollection.flashcards.length}
				{#if studyCollection.name}in "{studyCollection.name}"{/if}
			</p>

			{#if currentFlashcard}
				<div class="card-wrapper mx-auto" style="max-width: 500px; min-height: 300px;">
					<Card
						front={currentFlashcard.question}
						back={currentFlashcard.answer}
						imageUrl={currentFlashcard.imageUrl}
						flipped={currentFlashcard.flipped || false}
						on:toggle={(e) => handleCardToggle(e, currentFlashcard.id)}
					/>
				</div>
				<div class="mt-3 text-center text-xs text-gray-500">
					Viewed: {currentFlashcard.timesViewed}, Correct: {currentFlashcard.timesCorrect}
				</div>
			{:else}
				<p class="py-10 text-center text-red-500">
					Error: Current card data is not available or collection is empty.
				</p>
			{/if}

			<div
				class="mt-8 flex flex-col items-center justify-between space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0"
			>
				<button
					on:click={() => navigateCard(-1)}
					class="w-full rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
				>
					Previous
				</button>
				<div class="flex space-x-3">
					<button
						on:click={() => updateCorrectIncorrectAPI(false)}
						class="rounded-md bg-red-500 px-4 py-3 text-sm text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
					>
						Incorrect
					</button>
					<button
						on:click={() => updateCorrectIncorrectAPI(true)}
						class="rounded-md bg-green-500 px-4 py-3 text-sm text-white transition-colors hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
					>
						Correct
					</button>
				</div>
				<button
					on:click={() => navigateCard(1)}
					class="w-full rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
				>
					Next
				</button>
			</div>
		</div>
	{:else if selectedCollectionId && !isLoadingFlashcards && (!studyCollection || studyCollection.flashcards.length === 0)}
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
