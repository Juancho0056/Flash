<!-- src/routes/collections/[id].svelte -->
<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { goto } from '$app/navigation';
  import { onMount, afterUpdate } from 'svelte';
  import type { Collection, Flashcard } from '@prisma/client';
  import { getLastStudiedTimestamp } from '$lib/services/collectionMetaService';

  interface PageData {
    collection: Collection;
    flashcards: Flashcard[];
  }


  export let data: PageData;

  $: collection = data.collection;
  // Use a local reactive variable for flashcards to allow modification (e.g., on delete)
  let localFlashcards = data.flashcards ? [...data.flashcards] : [];
  let lastStudiedTimestamp: number | null = null;

  // Update localFlashcards if data.flashcards changes from an external source (e.g. HMR, re-navigation)
  afterUpdate(() => {
    if (data.flashcards && JSON.stringify(data.flashcards) !== JSON.stringify(localFlashcards.map(fc => ({...fc, selected: undefined})))) { // Basic check
        localFlashcards = data.flashcards ? [...data.flashcards] : [];
    }
  });

  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  // Modal State
  let isModalOpen = false;
  let modalConfig = { title: '', message: '', confirmText: 'Delete', itemType: ''};
  let itemToDeleteId: string | null = null;
  let isDeleting = false; // For modal loading state

  function openDeleteConfirmModal(id: string, question: string) {
    itemToDeleteId = id;
    modalConfig = {
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete the flashcard: "${question}" from this collection? This action cannot be undone.`,
        confirmText: 'Delete Flashcard',
        itemType: 'flashcard'
    };
    isModalOpen = true;
  }

  async function processDelete() {
    if (!itemToDeleteId) return;

    isDeleting = true;
    errorMessage = null;
    successMessage = null;

    try {
      const response = await fetch(`/api/flashcards/${itemToDeleteId}`, {
        method: 'DELETE',
      });

      if (response.status === 204) {
        successMessage = 'Flashcard deleted successfully.'; // TODO: Use Toast
        localFlashcards = localFlashcards.filter(fc => fc.id !== itemToDeleteId);
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to delete. Status: ${response.status}` }));
        throw new Error(errorData.message);
      }
    } catch (err: any) {
      errorMessage = err.message; // TODO: Use Toast
    } finally {
      isModalOpen = false;
      isDeleting = false;
      itemToDeleteId = null;
    }
  }

  function navigateToStudyMode() {
    // TODO: Enhance study mode to accept a collectionId to start with.
    // For now, if study mode can take collectionId as a query param:
    if (collection) {
      goto(`/study?collectionId=${collection.id}`);
    } else {
      goto('/study');
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
      return `Last studied: ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
  }

  onMount(() => {
    if (collection && typeof window !== 'undefined') { // collection comes from `data` prop
      lastStudiedTimestamp = getLastStudiedTimestamp(collection.id);
    }
  });
</script>

<svelte:head>
  <title>Collection: {collection?.name || 'View Collection'} - My Flashcards</title>
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

<div class="container mx-auto p-4 md:p-6">
  {#if collection}
    <div class="mb-6 p-4 md:p-6 bg-white rounded-lg shadow-lg">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">{collection.name}</h1>
      <p class="text-sm text-gray-500">
        Created on: {new Date(collection.createdAt).toLocaleDateString()}
      </p>
      <p class="text-sm text-gray-500 mb-4">
        {formatLastStudied(lastStudiedTimestamp)}
      </p>
      <div class="flex flex-wrap gap-3 items-center">
        <a href="/admin/new?collectionId={collection.id}" class="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors shadow-sm">
          + Add New Flashcard
        </a>
        {#if localFlashcards.length > 0}
        <button on:click={navigateToStudyMode} class="px-4 py-2 bg-purple-500 text-white text-sm rounded-md hover:bg-purple-600 transition-colors shadow-sm">
          Study This Collection
        </button>
        {/if}
         <a href="/" class="text-sm text-blue-600 hover:underline">Back to All Collections</a>
      </div>
    </div>

    {#if errorMessage}
      <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
        <p class="font-bold">Error</p><p>{errorMessage}</p>
      </div>
    {/if}
    {#if successMessage && !errorMessage}
      <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
        <p class="font-bold">Success</p><p>{successMessage}</p>
      </div>
    {/if}

    <h2 class="text-xl md:text-2xl font-semibold text-gray-700 mb-4 mt-8">Flashcards in "{collection.name}" ({localFlashcards.length})</h2>
    {#if localFlashcards.length > 0}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each localFlashcards as flashcard (flashcard.id)}
          <div class="flashcard-item border rounded-lg p-4 shadow-sm bg-white flex flex-col">
            <div class="flex-grow mb-3">
              <Card front={flashcard.question} back={flashcard.answer} imageUrl={flashcard.imageUrl} pronunciation={flashcard.pronunciation} />
            </div>
            <div class="text-xs text-gray-500 mb-3">
              <p>Viewed: {flashcard.timesViewed}, Correct: {flashcard.timesCorrect}</p>
              <p>Added: {new Date(flashcard.createdAt).toLocaleDateString()}</p>
            </div>
            <div class="mt-auto flex justify-start space-x-2 pt-3 border-t border-gray-100">
              <a href="/admin/new?edit={flashcard.id}&collectionId={collection.id}" class="px-3 py-1 text-xs bg-yellow-400 text-yellow-800 rounded hover:bg-yellow-500 transition-colors">Edit</a>
              <button
                on:click={() => openDeleteConfirmModal(flashcard.id, flashcard.question)}
                class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                title="Delete this flashcard"
              >🗑️ Delete</button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-gray-600 py-4 text-center bg-yellow-50 border border-yellow-200 rounded-md">
        This collection has no flashcards yet.
        <a href="/admin/new?collectionId={collection.id}" class="text-blue-500 hover:underline font-semibold">Add the first one!</a>
      </p>
    {/if}
  {:else}
     <div class="text-center py-10">
        <p class="text-xl text-gray-500">Loading collection details or collection not found.</p>
        <a href="/" class="mt-4 inline-block px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Go to Homepage
        </a>
    </div>
  {/if}
</div>

<style>
  .flashcard-item { min-height: 320px; }
</style>
