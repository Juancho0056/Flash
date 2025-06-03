<!-- src/routes/index.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client'; // Prisma types
  import Card from '$lib/components/Card.svelte'; // The Card component

  // Extend PrismaFlashcard to include a 'selected' state for UI
  interface Flashcard extends PrismaFlashcard {
    selected?: boolean;
  }

  interface CollectionWithCount extends Collection {
    _count?: { flashcards: number };
    flashcards?: Flashcard[]; // To store fetched flashcards for a selected collection
  }

  let collections: CollectionWithCount[] = [];
  let selectedCollection: CollectionWithCount | null = null;
  let selectedFlashcardIdsForExport: string[] = [];
  let exportLayout: 4 | 6 | 9 = 6; // Default layout
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let isLoadingCollections = true;
  let isLoadingFlashcards = false;

  async function fetchCollections() {
    isLoadingCollections = true;
    errorMessage = null;
    try {
      const response = await fetch('/api/collections');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch collections: ${response.status}`);
      }
      collections = await response.json();
    } catch (err: any) {
      errorMessage = err.message;
      console.error('Error fetching collections:', err);
    } finally {
      isLoadingCollections = false;
    }
  }

  async function fetchFlashcardsForCollection(collectionId: string) {
    if (!selectedCollection || selectedCollection.id !== collectionId) {
      const collection = collections.find(c => c.id === collectionId);
      if (collection) selectedCollection = { ...collection }; // Create a new object to trigger reactivity
      else {
        errorMessage = "Selected collection not found locally.";
        return;
      }
    }

    if (!selectedCollection) return;

    isLoadingFlashcards = true;
    errorMessage = null;
    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch flashcards for collection: ${response.status}`);
      }
      const fullCollectionData: CollectionWithCount = await response.json();
      if (selectedCollection) {
        // Ensure flashcards are initialized with 'selected: false'
        selectedCollection.flashcards = fullCollectionData.flashcards?.map(fc => ({ ...fc, selected: fc.selected || false })) || [];
      }
      selectedFlashcardIdsForExport = []; // Reset selection on new collection load
    } catch (err: any) {
      errorMessage = err.message;
      console.error('Error fetching flashcards:', err);
      if (selectedCollection) selectedCollection.flashcards = []; // Clear on error
    } finally {
      isLoadingFlashcards = false;
    }
  }

  function toggleFlashcardSelection(flashcardId: string) {
    if (selectedCollection && selectedCollection.flashcards) {
      const cardIndex = selectedCollection.flashcards.findIndex(fc => fc.id === flashcardId);
      if (cardIndex > -1) {
        // Toggle selection state
        selectedCollection.flashcards[cardIndex].selected = !selectedCollection.flashcards[cardIndex].selected;
        // Update the array of selected IDs
        if (selectedCollection.flashcards[cardIndex].selected) {
          selectedFlashcardIdsForExport = [...selectedFlashcardIdsForExport, flashcardId];
        } else {
          selectedFlashcardIdsForExport = selectedFlashcardIdsForExport.filter(id => id !== flashcardId);
        }
        // Trigger Svelte's reactivity by reassigning the array
        selectedCollection.flashcards = [...selectedCollection.flashcards];
      }
    }
  }


  async function handleExportPdf() {
    if (selectedFlashcardIdsForExport.length === 0) {
      errorMessage = 'Please select at least one flashcard to export.';
      return;
    }
    errorMessage = null;
    successMessage = null;

    try {
      const response = await fetch('/api/flashcards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedFlashcardIdsForExport,
          layout: exportLayout,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
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
      successMessage = 'PDF exported successfully!';

      // Clear selection states and IDs
      selectedFlashcardIdsForExport = [];
      if (selectedCollection?.flashcards) {
          selectedCollection.flashcards.forEach(fc => fc.selected = false);
          selectedCollection.flashcards = [...selectedCollection.flashcards]; // Trigger reactivity
      }

    } catch (err: any) {
      errorMessage = err.message;
      console.error('Error exporting PDF:', err);
    }
  }

  onMount(() => {
    fetchCollections();
  });

</script>

<svelte:head>
  <title>My Flashcards</title>
</svelte:head>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4 text-gray-700">Flashcard Collections</h1>

  {#if errorMessage}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Error: </strong>
      <span class="block sm:inline">{errorMessage}</span>
    </div>
  {/if}
  {#if successMessage}
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Success: </strong>
      <span class="block sm:inline">{successMessage}</span>
    </div>
  {/if}

  <nav class="my-6">
    <a href="/admin/new" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Create New Flashcard</a>
    <!-- TODO: Add link/button to create a new collection -->
  </nav>

  {#if isLoadingCollections}
    <p class="text-gray-500">Loading collections...</p>
  {:else if collections.length === 0}
    <p class="text-gray-500">No collections found. You can create flashcards (and assign them to new collections) using the link above.</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {#each collections as collection (collection.id)}
        <div
          class="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          class:ring-2={selectedCollection?.id === collection.id}
          class:ring-blue-500={selectedCollection?.id === collection.id}
          class:bg-gray-50={selectedCollection?.id !== collection.id}
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
        </div>
      {/each}
    </div>
  {/if}

  {#if selectedCollection}
    <hr class="my-6"/>
    <section aria-labelledby="collection-heading-{selectedCollection.id}">
      <h2 id="collection-heading-{selectedCollection.id}" class="text-2xl font-bold mb-4 text-gray-700">
        Flashcards in "{selectedCollection.name}"
      </h2>

      <div class="mb-6 p-4 border rounded-lg shadow-sm bg-gray-50">
          <h3 class="text-lg font-semibold mb-3 text-gray-700">Export Options</h3>
          <div class="flex flex-wrap items-center gap-4">
              <div>
                  <label for="layout" class="block text-sm font-medium text-gray-700 mb-1">Cards per page:</label>
                  <select id="layout" bind:value={exportLayout} class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm">
                      <option value={4}>4 (2x2)</option>
                      <option value={6}>6 (3x2)</option>
                      <option value={9}>9 (3x3)</option>
                  </select>
              </div>
              <button
                  on:click={handleExportPdf}
                  disabled={selectedFlashcardIdsForExport.length === 0 || isLoadingFlashcards}
                  class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                  Export Selected to PDF
              </button>
          </div>
          {#if selectedFlashcardIdsForExport.length > 0}
            <p class="text-sm mt-3 text-gray-600">{selectedFlashcardIdsForExport.length} card(s) selected for export.</p>
          {/if}
      </div>

      {#if isLoadingFlashcards}
        <p class="text-gray-500">Loading flashcards...</p>
      {:else if !selectedCollection.flashcards || selectedCollection.flashcards.length === 0}
        <p class="text-gray-600">This collection is empty. <a href="/admin/new?collectionId={selectedCollection.id}" class="text-blue-500 hover:underline">Add a flashcard to this collection.</a></p>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each selectedCollection.flashcards as flashcard (flashcard.id)}
            <div class="flashcard-item border rounded-lg p-4 shadow-sm bg-white flex flex-col">
              <div class="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="select-{flashcard.id}"
                  bind:checked={flashcard.selected}
                  on:change={() => toggleFlashcardSelection(flashcard.id)}
                  class="mr-3 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label for="select-{flashcard.id}" class="font-medium text-sm text-gray-700">Select for Export</label>
              </div>
              <div class="flex-grow">
                <Card
                  front={flashcard.question}
                  back={flashcard.answer}
                  imageUrl={flashcard.imageUrl}
                />
              </div>
              <div class="mt-3 text-xs text-gray-500">
                <p>Viewed: {flashcard.timesViewed}, Correct: {flashcard.timesCorrect}</p>
                <p>Created: {new Date(flashcard.createdAt).toLocaleDateString()}</p>
                 <p>Updated: {new Date(flashcard.updatedAt).toLocaleDateString()}</p>
              </div>
              <div class="mt-3 space-x-3">
                <a href="/admin/new?edit={flashcard.id}" class="text-sm text-blue-600 hover:underline">Edit</a>
                <!-- TODO: Implement Delete Flashcard button -->
                <!-- <button on:click={() => handleDeleteFlashcard(flashcard.id)} class="text-sm text-red-600 hover:underline">Delete</button> -->
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  /* Tailwind utility classes are used primarily. */
  /* Add component-specific styles or overrides here if necessary. */
  .flashcard-item {
    /* Example: ensure cards have a minimum height if Card.svelte does not enforce it */
    min-height: 250px; /* Adjust as needed for your Card component's typical content */
  }
  /* Style for when a collection is selected */
  .ring-2.ring-blue-500 {
    box-shadow: 0 0 0 2px theme('colors.blue.500');
  }
</style>
