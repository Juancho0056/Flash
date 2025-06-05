<!-- src/routes/admin/new.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Collection, Flashcard } from '@prisma/client';
	import { toast } from '$lib/toastStore'; // Import toast

	let question = '';
	let answer = '';
	let pronunciation = '';
	let example = '';
	let imageUrl: string | undefined = undefined;
	let selectedCollectionId: string | undefined = undefined;
	let collections: Collection[] = [];

	let isEditing = false;
	let flashcardIdToEdit: string | null = null;

	// Remove old message variables
	// let errorMessage: string | null = null;
	// let successMessage: string | null = null;
	let isLoadingCollections = true;
	let isSubmitting = false; // General submitting state for the main form
	let isSubmittingCollection = false; // Specific for collection creation

	async function fetchCollections() {
		isLoadingCollections = true;
		// errorMessage = null;
		try {
			const response = await fetch('/api/collections');
			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: 'Failed to fetch collections' }));
				throw new Error(errorData.message || 'Failed to fetch collections');
			}
			collections = await response.json();
		} catch (err: any) {
			toast.error(err.message || 'Failed to load collections.');
		} finally {
			isLoadingCollections = false;
		}
	}

	async function fetchFlashcardDetails(id: string) {
		isSubmitting = true; // Indicate loading
		// errorMessage = null;
		try {
			const response = await fetch(`/api/flashcards/${id}`);
			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: 'Failed to fetch flashcard details.' }));
				throw new Error(errorData.message || 'Failed to fetch flashcard details');
			}
			const flashcardData: Flashcard = await response.json();
			question = flashcardData.question;
			answer = flashcardData.answer;
			pronunciation = flashcardData.pronunciation || '';
			imageUrl = flashcardData.imageUrl || undefined;
			selectedCollectionId = flashcardData.collectionId || undefined;
		} catch (err: any) {
			toast.error(`Error loading flashcard: ${err.message}`);
		} finally {
			isSubmitting = false;
		}
	}

	onMount(async () => {
		await fetchCollections();
		const editId = $page.url.searchParams.get('edit');
		const newCollectionId = $page.url.searchParams.get('collectionId');

		if (editId) {
			isEditing = true;
			flashcardIdToEdit = editId;
			await fetchFlashcardDetails(editId);
		} else if (newCollectionId && collections.some((c) => c.id === newCollectionId)) {
			selectedCollectionId = newCollectionId;
		}
	});

	async function handleSubmitFlashcard() {
		if (!question.trim() || !answer.trim()) {
			toast.error('Question and Answer fields are required.');
			return;
		}

		isSubmitting = true;
		// errorMessage = null;
		// successMessage = null;

		const body = {
			question,
			answer,
			pronunciation: pronunciation.trim() !== '' ? pronunciation.trim() : null,
			example: example.trim() !== '' ? example.trim() : null,
			imageUrl: imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : null,
			collectionId: selectedCollectionId || null
		};

		try {
			const url =
				isEditing && flashcardIdToEdit ? `/api/flashcards/${flashcardIdToEdit}` : '/api/flashcards';
			const method = isEditing ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const responseBody = await response.json();

			if (!response.ok) {
				throw new Error(
					responseBody.message || `Failed to ${isEditing ? 'update' : 'create'} flashcard`
				);
			}

			toast.success(`Flashcard ${isEditing ? 'updated' : 'created'} successfully!`);

			if (!isEditing) {
				question = '';
				answer = '';
				example = '';
				pronunciation = '';
				imageUrl = undefined;
				// selectedCollectionId can be kept for convenience
			} else {
				// Optionally, could re-fetch details if something computed changes, or trust the update
			}
			// Consider redirecting or providing clear navigation options
			// setTimeout(() => goto('/'), 2000); // Example redirect
		} catch (err: any) {
			toast.error(
				err.message ||
					`An error occurred while ${isEditing ? 'updating' : 'creating'} the flashcard.`
			);
		} finally {
			isSubmitting = false;
		}
	}

	let newCollectionName = '';
	let isCreatingCollection = false;

	async function handleCreateCollection() {
		if (!newCollectionName.trim()) {
			toast.error('New collection name cannot be empty.');
			return;
		}
		isSubmittingCollection = true;
		// errorMessage = null;
		try {
			const response = await fetch('/api/collections', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newCollectionName.trim() })
			});
			const responseBody = await response.json();
			if (!response.ok) {
				throw new Error(responseBody.message || 'Failed to create collection');
			}

			const newCollection: Collection = responseBody;
			collections = [...collections, newCollection].sort((a, b) => a.name.localeCompare(b.name));
			selectedCollectionId = newCollection.id;
			newCollectionName = '';
			isCreatingCollection = false;
			toast.success(`Collection "${newCollection.name}" created and selected.`);
		} catch (err: any) {
			toast.error(err.message || 'Failed to create new collection.');
		} finally {
			isSubmittingCollection = false;
		}
	}
</script>

<svelte:head>
	<title>{isEditing ? 'Edit' : 'Create New'} Flashcard - My Flashcards</title>
</svelte:head>

<div class="container mx-auto max-w-2xl p-4 md:p-6">
	<h1 class="mb-6 text-2xl font-bold text-gray-800 md:text-3xl">
		{isEditing ? 'Edit Flashcard' : 'Create New Flashcard'}
	</h1>

	<!-- Old message divs removed -->

	<form
		on:submit|preventDefault={handleSubmitFlashcard}
		class="space-y-6 rounded-lg bg-white p-6 shadow-xl md:p-8"
	>
		<div>
			<label for="question" class="mb-1 block text-sm font-medium text-gray-700">Question</label>
			<textarea
				id="question"
				bind:value={question}
				rows="4"
				required
				class="mt-1 block w-full rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="Enter the question..."
			></textarea>
		</div>
		<div>
			<label for="pronunciation" class="mb-1 block text-sm font-medium text-gray-700">Pronunciation (Optional)</label>
			<input
				id="pronunciation"
				type="text"
				bind:value={pronunciation}
				class="mt-1 block w-full rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="e.g., /ˈmʌŋ.ki/ or monkey"
			/>
		</div>
		<div>
			<label for="answer" class="mb-1 block text-sm font-medium text-gray-700">Answer</label>
			<textarea
				id="answer"
				bind:value={answer}
				rows="4"
				required
				class="mt-1 block w-full rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="Enter the answer..."
			></textarea>
		</div>
		<div>
			<label for="example" class="mb-1 block text-sm font-medium text-gray-700">Example (Optional)</label>
			<textarea
				id="example"
				bind:value={example}
				rows="3"
				class="mt-1 block w-full rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="e.g., I eat an apple every day."
			></textarea>
		</div>
		<div>
			<label for="imageUrl" class="mb-1 block text-sm font-medium text-gray-700"
				>Image URL (Optional)</label
			>
			<input
				type="url"
				id="imageUrl"
				bind:value={imageUrl}
				class="mt-1 block w-full rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="e.g., https://example.com/image.png"
			/>
		</div>

		<div>
			<label for="collection" class="mb-1 block text-sm font-medium text-gray-700"
				>Collection (Optional)</label
			>
			{#if isLoadingCollections}
				<p class="py-2 text-sm text-gray-500">Loading collections...</p>
			{:else}
				<div class="mt-1 flex items-stretch space-x-2">
					<select
						id="collection"
						bind:value={selectedCollectionId}
						class="block w-full rounded-md border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					>
						<option value={undefined}>-- No Collection --</option>
						{#each collections as collection (collection.id)}
							<option value={collection.id}>{collection.name}</option>
						{/each}
					</select>
					<button
						type="button"
						on:click={() => (isCreatingCollection = !isCreatingCollection)}
						title={isCreatingCollection ? 'Cancel new collection' : 'Add new collection'}
						class="whitespace-nowrap rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
					>
						{isCreatingCollection ? 'Cancel' : '+ New'}
					</button>
				</div>
				{#if isCreatingCollection}
					<div class="mt-3 rounded-md border bg-gray-50 p-3">
						<label for="newCollectionName" class="mb-1 block text-sm font-medium text-gray-700"
							>New Collection Name:</label
						>
						<div class="flex items-center space-x-2">
							<input
								type="text"
								id="newCollectionName"
								bind:value={newCollectionName}
								placeholder="Enter name..."
								class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
							<button
								type="button"
								on:click={handleCreateCollection}
								disabled={isSubmittingCollection || !newCollectionName.trim()}
								class="whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
							>
								{isSubmittingCollection ? 'Creating...' : 'Create'}
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<div class="mt-8 flex items-center justify-end space-x-4 border-t border-gray-200 pt-4">
			<a
				href="/"
				class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
			>
				Back to List
			</a>
			<button
				type="submit"
				disabled={isSubmitting || (isCreatingCollection && isSubmittingCollection)}
				class="rounded-md bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
			>
				{isSubmitting ? 'Saving...' : isEditing ? 'Update Flashcard' : 'Create Flashcard'}
			</button>
		</div>
	</form>
</div>
