<!-- src/routes/index.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Collection, Flashcard as PrismaFlashcard } from '@prisma/client';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { toast } from '$lib/toastStore'; // Import toast store

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
  // Remove old message variables if toasts replace them fully
  // let errorMessage: string | null = null;
  // let successMessage: string | null = null;
  let isLoadingCollections = true;
  let isLoadingFlashcards = false;

  let isModalOpen = false;
  let modalConfig = { title: '', message: '', confirmText: 'Delete', itemType: ''};
  let itemToDeleteId: string | null = null;
  let isDeleting = false;

  async function fetchCollections() {
    isLoadingCollections = true;
    // errorMessage = null; // Not needed if using toasts
    try {
      const response = await fetch('/api/collections');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'Failed to fetch collections'}));
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
    const collection = collections.find(c => c.id === collectionId);
    if (collection) selectedCollection = { ...collection };
    else {
      toast.error("Selected collection not found locally.");
      return;
    }

    if (!selectedCollection) return;

    isLoadingFlashcards = true;
    // successMessage = null; // Clear messages when loading
    // errorMessage = null;
    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'Failed to fetch flashcards'}));
        throw new Error(errorData.message || `Failed to fetch flashcards for collection: ${response.status}`);
      }
      const fullCollectionData: CollectionWithCount = await response.json();
      if (selectedCollection) {
        selectedCollection.flashcards = fullCollectionData.flashcards?.map(fc => ({ ...fc, selected: false })) || [];
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
      const cardIndex = selectedCollection.flashcards.findIndex(fc => fc.id === flashcardId);
      if (cardIndex > -1) {
        selectedCollection.flashcards[cardIndex].selected = !selectedCollection.flashcards[cardIndex].selected;
        if (selectedCollection.flashcards[cardIndex].selected) {
          selectedFlashcardIdsForExport = [...selectedFlashcardIdsForExport, flashcardId];
        } else {
          selectedFlashcardIdsForExport = selectedFlashcardIdsForExport.filter(id => id !== flashcardId);
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
        body: JSON.stringify({ ids: selectedFlashcardIdsForExport, layout: exportLayout }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'PDF Export failed'}));
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
          selectedCollection.flashcards.forEach(fc => fc.selected = false);
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
        method: 'DELETE',
      });

      if (response.status === 204) {
        toast.success('Flashcard deleted successfully.');
        if (selectedCollection && selectedCollection.flashcards) {
          selectedCollection.flashcards = selectedCollection.flashcards.filter(fc => fc.id !== itemToDeleteId);
          selectedFlashcardIdsForExport = selectedFlashcardIdsForExport.filter(id => id !== itemToDeleteId);
        }
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to delete. Status: ${response.status}` }));
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

  onMount(() => {
    fetchCollections();
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
  on:cancel={() => isModalOpen = false}
/>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4 text-gray-700">Flashcard Collections</h1>

  <!-- Old message divs are removed as toasts will handle feedback -->

  <nav class="my-6 flex flex-wrap justify-between items-center gap-4">
    <a href="/admin/new" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Create New Flashcard</a>
    <a href="/admin/collections/new" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">+ Nueva Colección</a>
  </nav>

  {#if isLoadingCollections}
    <p class="text-gray-500">Loading collections...</p>
  {:else if collections.length === 0}
    <p class="text-gray-500">No collections found.</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {#each collections as collection (collection.id)}
        <div
          class="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          class:ring-2={selectedCollection?.id === collection.id}
          class:ring-blue-500={selectedCollection?.id === collection.id}
          class:bg-blue-50={selectedCollection?.id === collection.id}
          on:click={() => fetchFlashcardsForCollection(collection.id)}
          on:keypress={(e) => e.key === 'Enter' && fetchFlashcardsForCollection(collection.id)}
          tabindex="0" role="button" aria-pressed={selectedCollection?.id === collection.id}
          aria-label={`Select collection ${collection.name}`}
        >
          <h2 class="text-xl font-semibold text-gray-800">{collection.name}</h2>
          <p class="text-sm text-gray-600">{collection._count?.flashcards || 0} flashcard(s)</p>
           <a href="/collections/{collection.id}" on:click|stopPropagation class="text-xs text-blue-600 hover:underline mt-1 inline-block">View Collection</a>
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
                      <option value={4}>4 (2x2)</option><option value={6}>6 (3x2)</option><option value={9}>9 (3x3)</option>
                  </select>
              </div>
              <button
                  on:click={handleExportPdf}
                  disabled={selectedFlashcardIdsForExport.length === 0 || isLoadingFlashcards}
                  class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >Export Selected to PDF</button>
          </div>
          {#if selectedFlashcardIdsForExport.length > 0}
            <p class="text-sm mt-3 text-gray-600">{selectedFlashcardIdsForExport.length} card(s) selected for export.</p>
          {/if}
      </div>

      {#if isLoadingFlashcards}
        <p class="text-gray-500">Loading flashcards...</p>
      {:else if !selectedCollection.flashcards || selectedCollection.flashcards.length === 0}
        <p class="text-gray-600">This collection is empty. <a href="/admin/new?collectionId={selectedCollection.id}" class="text-blue-500 hover:underline">Add a flashcard.</a></p>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each selectedCollection.flashcards as flashcard (flashcard.id)}
            <div class="flashcard-item border rounded-lg p-4 shadow-sm bg-white flex flex-col">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                  <input type="checkbox" id="select-{flashcard.id}" bind:checked={flashcard.selected}
                         on:change={() => toggleFlashcardSelection(flashcard.id)}
                         class="mr-3 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                  <label for="select-{flashcard.id}" class="font-medium text-sm text-gray-700">Select</label>
                </div>
              </div>
              <div class="flex-grow mb-3"><Card front={flashcard.question} back={flashcard.answer} imageUrl={flashcard.imageUrl} /></div>
              <div class="text-xs text-gray-500 mb-3">
                <p>Viewed: {flashcard.timesViewed}, Correct: {flashcard.timesCorrect}</p>
                <p>Created: {new Date(flashcard.createdAt).toLocaleDateString()}</p>
                <p>Updated: {new Date(flashcard.updatedAt).toLocaleDateString()}</p>
              </div>
              <div class="mt-auto flex justify-start space-x-2 pt-3 border-t border-gray-100">
                <a href="/admin/new?edit={flashcard.id}" class="px-3 py-1 text-xs bg-yellow-400 text-yellow-800 rounded hover:bg-yellow-500 transition-colors">Edit</a>
                <button
                  on:click={() => openDeleteConfirmModal(flashcard.id, flashcard.question)}
                  class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  title="Delete this flashcard"
                >🗑️ Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .flashcard-item { min-height: 320px; }
  .ring-2.ring-blue-500 { box-shadow: 0 0 0 2px theme('colors.blue.500'); }
</style>
