<!-- src/routes/index.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { toast } from '$lib/toastStore'; // Import toast store
	import { getAllLastStudiedTimestamps } from '$lib/services/collectionMetaService';
	// import type { CollectionTimestamps } from '$lib/services/collectionMetaService'; // Type import if needed

	interface Flashcard extends PrismaFlashcard {
		selected?: boolean;
	}

	interface CollectionWithCount extends Collection {
		_count?: { flashcards: number };
		flashcards?: Flashcard[];
	}

	let collections: CollectionWithCount[] = [];
	let selectedCollection: CollectionWithCount | null = null;
	let selectedFlashcardIdsForExport: string[] = [];
	let exportLayout: 4 | 6 | 9 = 6;
	let isLoadingCollections = true;
	let isLoadingFlashcards = false;
	let collectionLastStudied: Record<string, number> = {};

	let isModalOpen = false;
	let modalConfig = { title: '', message: '', confirmText: 'Delete', itemType: '' };
	let itemToDeleteId: string | null = null;
	let isDeleting = false;

	async function fetchCollections() {
		isLoadingCollections = true;
		// errorMessage = null; // Not needed if using toasts
		try {
			const response = await fetch('/api/collections');
			console.log(response);
			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: 'Failed to fetch collections' }));
				throw new Error(errorData.message || `Failed to fetch collections: ${response.status}`);
			}
			collections = await response.json();
		} catch (err: any) {
			toast.error(err.message || 'Failed to load collections.');
			console.error('Error fetching collections:', err);
		} finally {
			isLoadingCollections = false;
		}
	}

	async function fetchFlashcardsForCollection(collectionId: string) {
		const collection = collections.find((c) => c.id === collectionId);
		if (collection) selectedCollection = { ...collection };
		else {
			toast.error('Selected collection not found locally.');
			return;
		}

		if (!selectedCollection) return;

		isLoadingFlashcards = true;
		// successMessage = null; // Clear messages when loading
		// errorMessage = null;
		try {
			const response = await fetch(`/api/collections/${collectionId}`);
			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: 'Failed to fetch flashcards' }));
				throw new Error(
					errorData.message || `Failed to fetch flashcards for collection: ${response.status}`
				);
			}
			const fullCollectionData: CollectionWithCount = await response.json();
			if (selectedCollection) {
				selectedCollection.flashcards =
					fullCollectionData.flashcards?.map((fc) => ({ ...fc, selected: false })) || [];
			}
			selectedFlashcardIdsForExport = [];
		} catch (err: any) {
			toast.error(err.message || 'Failed to load flashcards for the selected collection.');
			console.error('Error fetching flashcards:', err);
			if (selectedCollection) selectedCollection.flashcards = [];
		} finally {
			isLoadingFlashcards = false;
		}
	}

	function toggleFlashcardSelection(flashcardId: string) {
		if (selectedCollection && selectedCollection.flashcards) {
			const cardIndex = selectedCollection.flashcards.findIndex((fc) => fc.id === flashcardId);
			if (cardIndex > -1) {
				selectedCollection.flashcards[cardIndex].selected =
					!selectedCollection.flashcards[cardIndex].selected;
				if (selectedCollection.flashcards[cardIndex].selected) {
					selectedFlashcardIdsForExport = [...selectedFlashcardIdsForExport, flashcardId];
				} else {
					selectedFlashcardIdsForExport = selectedFlashcardIdsForExport.filter(
						(id) => id !== flashcardId
					);
				}
				selectedCollection.flashcards = [...selectedCollection.flashcards];
			}
		}
	}

	async function handleExportPdf() {
		if (selectedFlashcardIdsForExport.length === 0) {
			toast.warning('Please select at least one flashcard to export.');
			return;
		}
		// toast.info("PDF export initiated..."); // Optional: immediate feedback
		try {
			const response = await fetch('/api/flashcards/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: selectedFlashcardIdsForExport, layout: exportLayout })
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'PDF Export failed' }));
				throw new Error(errorData.message || `PDF Export failed: ${response.status}`);
			}
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `flashcards-export-${Date.now()}.pdf`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
			toast.success('PDF exported successfully and download started!');
			selectedFlashcardIdsForExport = [];
			if (selectedCollection?.flashcards) {
				selectedCollection.flashcards.forEach((fc) => (fc.selected = false));
				selectedCollection.flashcards = [...selectedCollection.flashcards];
			}
		} catch (err: any) {
			toast.error(err.message || 'An unexpected error occurred during PDF export.');
			console.error('Error exporting PDF:', err);
		}
	}

	function openDeleteConfirmModal(id: string, question: string) {
		itemToDeleteId = id;
		modalConfig = {
			title: 'Confirm Deletion',
			message: `Are you sure you want to delete the flashcard: "${question}"? This action cannot be undone.`,
			confirmText: 'Delete Flashcard',
			itemType: 'flashcard'
		};
		isModalOpen = true;
	}

	async function processDelete() {
		if (!itemToDeleteId) return;

		isDeleting = true;
		try {
			const response = await fetch(`/api/flashcards/${itemToDeleteId}`, {
				method: 'DELETE'
			});

			if (response.status === 204) {
				toast.success('Flashcard deleted successfully.');
				if (selectedCollection && selectedCollection.flashcards) {
					selectedCollection.flashcards = selectedCollection.flashcards.filter(
						(fc) => fc.id !== itemToDeleteId
					);
					selectedFlashcardIdsForExport = selectedFlashcardIdsForExport.filter(
						(id) => id !== itemToDeleteId
					);
				}
			} else if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: `Failed to delete. Status: ${response.status}` }));
				throw new Error(errorData.message);
			}
		} catch (err: any) {
			toast.error(err.message || 'Failed to delete flashcard.');
			console.error('Error deleting flashcard:', err);
		} finally {
			isModalOpen = false;
			isDeleting = false;
			itemToDeleteId = null;
		}
	}

	function formatLastStudied(timestamp: number | undefined | null): string {
		if (!timestamp) return 'Not studied yet';

		const date = new Date(timestamp);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(today.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Studied today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			return 'Studied yesterday';
		} else {
			// Simple date format, e.g., YYYY-MM-DD
			return `Last studied: ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		}
	}

	onMount(async () => {
		await fetchCollections();
		if (typeof window !== 'undefined') {
			collectionLastStudied = getAllLastStudiedTimestamps();
		}
	});

	function selectAll() {
		const updated = selectedCollection?.flashcards?.map(f => ({ ...f, selected: true })) || [];
		selectedFlashcardIdsForExport = updated.map(f => f.id);
		if (selectedCollection) selectedCollection.flashcards = updated;
	}

	function selectFirst(n: number) {
		const selected = selectedCollection?.flashcards?.slice(0, n) || [];
		const updated = selectedCollection?.flashcards?.map(f => ({ ...f, selected: selected.includes(f) })) || [];
		selectedFlashcardIdsForExport = selected.map(f => f.id);
		if (selectedCollection) selectedCollection.flashcards = updated;
	}

	function selectLast(n: number) {
		const selected = selectedCollection?.flashcards?.slice(-n) || [];
		const updated = selectedCollection?.flashcards?.map(f => ({ ...f, selected: selected.includes(f) })) || [];
		selectedFlashcardIdsForExport = selected.map(f => f.id);
		if (selectedCollection) selectedCollection.flashcards = updated;
	}

	function selectRandom(n: number) {
		const shuffled = [...(selectedCollection?.flashcards || [])].sort(() => 0.5 - Math.random());
		const selected = shuffled.slice(0, n);
		const updated = selectedCollection?.flashcards?.map(f => ({ ...f, selected: selected.includes(f) })) || [];
		selectedFlashcardIdsForExport = selected.map(f => f.id);
		if (selectedCollection) selectedCollection.flashcards = updated;
	}

  $: selectedCollection?.flashcards?.forEach(flashcard => {
    flashcard.selected = selectedFlashcardIdsForExport.includes(flashcard.id);
  });

</script>

<svelte:head>
	<title>My Flashcards</title>
</svelte:head>

<Modal
	bind:isOpen={isModalOpen}
	title={modalConfig.title}
	message={modalConfig.message}
	confirmText={modalConfig.confirmText}
	isLoading={isDeleting}
	on:confirm={processDelete}
	on:cancel={() => (isModalOpen = false)}
/>

<div class="container mx-auto p-4">
	<h1 class="mb-4 text-2xl font-bold text-gray-700">Flashcard Collections</h1>

	<!-- Old message divs are removed as toasts will handle feedback -->

	<nav class="my-6 flex flex-wrap items-center justify-between gap-4">
		<a
			href="/admin/new"
			class="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
			>Create New Flashcard</a
		>
		<a
			href="/admin/collections/new"
			class="rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600"
			>+ Nueva Colección</a
		>
	</nav>

	{#if isLoadingCollections}
		<p class="text-gray-500">Loading collections...</p>
	{:else if collections.length === 0}
		<p class="text-gray-500">No collections found.</p>
	{:else}
		<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each collections as collection (collection.id)}
				
				<div
					class="cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-6 hover:shadow-md"
					class:ring-2={selectedCollection?.id === collection.id}
					class:ring-blue-500={selectedCollection?.id === collection.id}
					class:bg-blue-50={selectedCollection?.id === collection.id}
					on:click={() => fetchFlashcardsForCollection(collection.id)}
					on:keypress={(e) => e.key === 'Enter' && fetchFlashcardsForCollection(collection.id)}
					tabindex="0"
					role="button"
					aria-pressed={selectedCollection?.id === collection.id}
					aria-label={`Select collection ${collection.name}`}
				>
					<h2 class="text-xl font-semibold text-gray-800">{collection.name}</h2>
					<p class="text-sm text-gray-600">{collection._count?.flashcards || 0} flashcard(s)</p>
					
					<p class="text-xs text-gray-500 mt-1">{formatLastStudied(collectionLastStudied[collection.id])}</p>
					<a
						href="/collections/{collection.id}"
						on:click|stopPropagation
						class="mt-1 inline-block text-xs text-blue-600 hover:underline">View Collection</a
					>
					<a
					href={`/admin/collections/${collection.id}/import`}
					on:click|stopPropagation
					class="mt-1 inline-block text-xs text-indigo-600 hover:underline"
					>
						📥 Import Flashcards
					</a>
				</div>
			{/each}
		</div>
	{/if}

	{#if selectedCollection}
		<hr class="my-6" />
		<section aria-labelledby="collection-heading-{selectedCollection.id}">
			<h2
				id="collection-heading-{selectedCollection.id}"
				class="mb-4 text-2xl font-bold text-gray-700"
			>
				Flashcards in "{selectedCollection.name}"
			</h2>
			<!-- Controles de selección rápida -->
			<div class="flex gap-3 flex-wrap my-4">
			<button on:click={selectAll} class="btn bg-blue-500 text-white px-3 py-1 rounded cursor-pointer">Select All</button>
			<button on:click={() => selectFirst(10)} class="btn bg-green-500 text-white px-3 py-1 rounded cursor-pointer">First 10</button>
			<button on:click={() => selectLast(10)} class="btn bg-purple-500 text-white px-3 py-1 rounded cursor-pointer">Last 10</button>
			<button on:click={() => selectRandom(10)} class="btn bg-indigo-500 text-white px-3 py-1 rounded cursor-pointer">Random 10</button>
			</div>

			<div class="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow">
				<h3 class="mb-3 text-lg font-semibold text-gray-700">Export Options</h3>
				<div class="flex flex-wrap items-end gap-4">
				<div class="flex flex-col">
					<label for="layout" class="text-sm text-gray-600 mb-1">Cards per page:</label>
					<select bind:value={exportLayout} class="rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:ring focus:ring-indigo-500 text-sm cursor-pointer">
					<option value={4}>4 (2x2)</option>
					<option value={6}>6 (3x2)</option>
					<option value={9}>9 (3x3)</option>
					</select>
				</div>
				<button on:click={handleExportPdf} disabled={selectedFlashcardIdsForExport.length === 0 || isLoadingFlashcards} class="cursor-pointer rounded bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-white text-sm font-medium shadow disabled:cursor-not-allowed disabled:bg-gray-300">
					Export Selected to PDF
				</button>
				</div>
				{#if selectedFlashcardIdsForExport.length > 0}
				<p class="mt-3 text-sm text-gray-600">{selectedFlashcardIdsForExport.length} card(s) selected for export.</p>
				{/if}
			</div>


			{#if isLoadingFlashcards}
				<p class="text-gray-500">Loading flashcards...</p>
			{:else if !selectedCollection.flashcards || selectedCollection.flashcards.length === 0}
				<p class="text-gray-600">
					This collection is empty. <a
						href="/admin/new?collectionId={selectedCollection.id}"
						class="text-blue-500 hover:underline">Add a flashcard.</a
					>
				</p>
			{:else}
				 <div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each selectedCollection.flashcards as flashcard (flashcard.id)}
						<div
							class={`flashcard-item flex flex-col rounded-xl p-4 transition-transform duration-200 hover:scale-[1.01] ${
								flashcard.selected
								? 'ring-2 ring-indigo-500 bg-indigo-50 border-transparent'
								: 'border border-gray-200 bg-white shadow-sm'
							}`}
>
							<div class="mb-3 flex items-center">
								<div class="flex items-center">
									<input
										type="checkbox"
										id="select-{flashcard.id}"
										checked={flashcard.selected}
										on:change={() => toggleFlashcardSelection(flashcard.id)}
										class="mr-2 h-4 w-4 text-indigo-600 rounded focus:ring focus:ring-indigo-500 border-gray-300"
									/>
									<label for="select-{flashcard.id}" class="text-sm font-medium text-gray-700"
										></label
									>
								</div>
							</div>
							<div class="flex-grow mb-3 flex items-center justify-center">
								<Card
									front={flashcard.question}
									back={flashcard.answer}
									pronunciation={flashcard.pronunciation}
									example={flashcard.example}
									imageUrl={flashcard.imageUrl}
								/>
							</div>
							<div class="mb-3 text-xs text-gray-500">
								<p>Viewed: {flashcard.timesViewed}, Correct: {flashcard.timesCorrect}</p>
								<p>Created: {new Date(flashcard.createdAt).toLocaleDateString()}</p>
								<p>Updated: {new Date(flashcard.updatedAt).toLocaleDateString()}</p>
							</div>
							<div class="mt-auto flex justify-start gap-2 border-t border-gray-100 pt-3">
								<a
									href="/admin/new?edit={flashcard.id}"
									class="rounded bg-yellow-400 px-3 py-1 text-xs text-yellow-800 transition-colors hover:bg-yellow-500"
									>Edit</a
								>
								<button
									on:click={() => openDeleteConfirmModal(flashcard.id, flashcard.question)}
									class="rounded bg-red-500 hover:bg-red-600 px-3 py-1 text-xs font-medium text-white cursor-pointer"
									title="Delete this flashcard">🗑️ Delete</button
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.flashcard-item {
		min-height: 320px;
	}
</style>
