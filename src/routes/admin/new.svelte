<!-- src/routes/admin/new.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { Collection, Flashcard } from '@prisma/client';

  let question = '';
  let answer = '';
  let imageUrl: string | undefined = undefined;
  let selectedCollectionId: string | undefined = undefined;
  let collections: Collection[] = [];

  let isEditing = false;
  let flashcardIdToEdit: string | null = null;

  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let isLoadingCollections = true;
  let isSubmitting = false;

  async function fetchCollections() {
    isLoadingCollections = true;
    errorMessage = null; // Clear previous errors
    try {
      const response = await fetch('/api/collections');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch collections');
      }
      collections = await response.json();
    } catch (err: any) {
      errorMessage = err.message;
    } finally {
      isLoadingCollections = false;
    }
  }

  async function fetchFlashcardDetails(id: string) {
    isSubmitting = true; // Use isSubmitting to indicate loading details
    errorMessage = null;
    try {
      const response = await fetch(`/api/flashcards/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch flashcard details');
      }
      const flashcard: Flashcard = await response.json();
      question = flashcard.question;
      answer = flashcard.answer;
      imageUrl = flashcard.imageUrl || undefined;
      selectedCollectionId = flashcard.collectionId || undefined;
    } catch (err: any) {
      errorMessage = `Error loading flashcard: ${err.message}`;
    } finally {
      isSubmitting = false;
    }
  }

  onMount(async () => {
    await fetchCollections(); // Fetch collections first
    const editId = $page.url.searchParams.get('edit');
    const newCollectionId = $page.url.searchParams.get('collectionId'); // For pre-selecting collection

    if (editId) {
      isEditing = true;
      flashcardIdToEdit = editId;
      await fetchFlashcardDetails(editId); // Then fetch card details if editing
    } else if (newCollectionId && collections.some(c => c.id === newCollectionId)) {
      selectedCollectionId = newCollectionId;
    }
  });

  async function handleSubmit() {
    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    if (!question.trim() || !answer.trim()) {
      errorMessage = 'Question and Answer fields are required.';
      isSubmitting = false;
      return;
    }

    const body = {
      question,
      answer,
      imageUrl: imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : null,
      collectionId: selectedCollectionId || null,
    };

    try {
      const url = isEditing && flashcardIdToEdit ? `/api/flashcards/${flashcardIdToEdit}` : '/api/flashcards';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseBody = await response.json(); // Try to parse JSON regardless of ok status for error messages

      if (!response.ok) {
        throw new Error(responseBody.message || `Failed to ${isEditing ? 'update' : 'create'} flashcard`);
      }

      successMessage = `Flashcard ${isEditing ? 'updated' : 'created'} successfully! ID: ${responseBody.id}`;

      if (!isEditing) {
        // Clear form for new entry after successful creation
        question = '';
        answer = '';
        imageUrl = undefined;
        // Optionally keep selectedCollectionId or clear it
        // selectedCollectionId = undefined;
      } else {
         // If editing, could re-fetch collections or specific card if data shown on page changes
         // For now, just show success message.
      }
      // Consider redirecting after a short delay or providing a link
      // setTimeout(() => goto('/'), 2000);
    } catch (err: any) {
      errorMessage = err.message;
    } finally {
      isSubmitting = false;
    }
  }

  let newCollectionName = '';
  let isCreatingCollection = false;

  async function handleCreateCollection() {
    if (!newCollectionName.trim()) {
        errorMessage = "New collection name cannot be empty.";
        return;
    }
    isSubmitting = true; // Reuse for this action too
    errorMessage = null;
    // successMessage = null; // Keep existing success messages if any
    try {
        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newCollectionName.trim() }),
        });
        const responseBody = await response.json();
        if (!response.ok) {
            throw new Error(responseBody.message || 'Failed to create collection');
        }

        const newCollection: Collection = responseBody;
        collections = [...collections, newCollection].sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
        selectedCollectionId = newCollection.id;
        newCollectionName = '';
        isCreatingCollection = false;
        successMessage = `Collection "${newCollection.name}" created and selected.`;
    } catch (err: any) {
        errorMessage = err.message;
    } finally {
        isSubmitting = false;
    }
  }

</script>

<svelte:head>
  <title>{isEditing ? 'Edit' : 'Create New'} Flashcard - My Flashcards</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-6 max-w-2xl">
  <h1 class="text-2xl md:text-3xl font-bold mb-6 text-gray-800">{isEditing ? 'Edit Flashcard' : 'Create New Flashcard'}</h1>

  {#if errorMessage}
    <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
      <p class="font-bold">Error</p>
      <p>{errorMessage}</p>
    </div>
  {/if}
  {#if successMessage && !errorMessage}
    <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
      <p class="font-bold">Success</p>
      <p>{successMessage}</p>
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit} class="space-y-6 bg-white p-6 md:p-8 rounded-lg shadow-xl">
    <div>
      <label for="question" class="block text-sm font-medium text-gray-700 mb-1">Question</label>
      <textarea id="question" bind:value={question} rows="4" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter the question..."></textarea>
    </div>

    <div>
      <label for="answer" class="block text-sm font-medium text-gray-700 mb-1">Answer</label>
      <textarea id="answer" bind:value={answer} rows="4" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter the answer..."></textarea>
    </div>

    <div>
      <label for="imageUrl" class="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
      <input type="url" id="imageUrl" bind:value={imageUrl} class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., https://example.com/image.png"/>
    </div>

    <div>
      <label for="collection" class="block text-sm font-medium text-gray-700 mb-1">Collection (Optional)</label>
      {#if isLoadingCollections}
        <p class="text-sm text-gray-500 py-2">Loading collections...</p>
      {:else}
        <div class="flex items-stretch space-x-2 mt-1">
            <select id="collection" bind:value={selectedCollectionId} class="block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
              <option value={undefined}>-- No Collection --</option>
              {#each collections as collection (collection.id)}
                <option value={collection.id}>{collection.name}</option>
              {/each}
            </select>
            <button type="button" on:click={() => isCreatingCollection = !isCreatingCollection} title={isCreatingCollection ? 'Cancel new collection' : 'Add new collection'}
                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap">
              {isCreatingCollection ? 'Cancel' : '+ New'}
            </button>
        </div>
        {#if isCreatingCollection}
            <div class="mt-3 p-3 bg-gray-50 rounded-md border">
                <label for="newCollectionName" class="block text-sm font-medium text-gray-700 mb-1">New Collection Name:</label>
                <div class="flex items-center space-x-2">
                    <input type="text" id="newCollectionName" bind:value={newCollectionName} placeholder="Enter name..." class="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                    <button type="button" on:click={handleCreateCollection} disabled={isSubmitting || !newCollectionName.trim()} class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 whitespace-nowrap">Create</button>
                </div>
            </div>
        {/if}
      {/if}
    </div>

    <div class="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 mt-8">
        <a href="/" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Back to List
        </a>
        <button type="submit" disabled={isSubmitting} class="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          {isSubmitting ? 'Saving...' : (isEditing ? 'Update Flashcard' : 'Create Flashcard')}
        </button>
    </div>
  </form>
</div>
