<script lang="ts">
  import type { PageData } from './$types';
  import type { Collection } from '@prisma/client';
  import * as studyHistoryService from '$lib/services/studyHistoryService'; // For client-side filtering
  import { onMount } from 'svelte';

  export let data: PageData;

  let displayHistoryEntries = data.historyEntries;
  let collectionsForFilter = data.collections;
  let selectedCollectionId: string = 'all'; // 'all' or a collection ID
  let clientSideError: string | null = null;

  // History is loaded client-side if initial SSR load from +page.ts might miss localStorage
  onMount(() => {
    try {
      const clientHistory = studyHistoryService.getStudyHistory();
      if (clientHistory.length !== displayHistoryEntries.length) {
        // Update if client-side load has more data (e.g. SSR returned empty due to no localStorage)
        displayHistoryEntries = clientHistory;
      }
      // If collections also failed to load via SSR/fetch, could try client-side fetch here too if needed
    } catch (e) {
      console.error("Error loading history on client:", e);
      clientSideError = "Could not refresh history data on the client.";
    }
  });

  function handleFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedCollectionId = target.value;
    if (selectedCollectionId === 'all') {
      displayHistoryEntries = studyHistoryService.getStudyHistory();
    } else {
      displayHistoryEntries = studyHistoryService.getStudyHistoryByCollection(selectedCollectionId);
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function formatDuration(ms: number): string {
    if (ms < 0) ms = 0; // Ensure no negative duration
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  function getStatusClass(status?: string): string {
    switch (status) {
      case 'mastered': return 'text-green-600 font-semibold';
      case 'completed': return 'text-blue-600';
      case 'incomplete': return 'text-orange-600';
      default: return 'text-gray-500';
    }
  }
</script>

<svelte:head>
  <title>{data.title || 'Study History'}</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
  <h1 class="text-2xl font-bold mb-6 text-gray-800">Study History</h1>

  {#if data.error}
    <p class="text-red-500 bg-red-100 p-4 rounded-md">{data.error}</p>
  {/if}
  {#if clientSideError}
     <p class="text-red-500 bg-red-100 p-4 rounded-md mb-4">{clientSideError}</p>
  {/if}

  {#if collectionsForFilter && collectionsForFilter.length > 0}
    <div class="mb-6">
      <label for="collectionFilter" class="block text-sm font-medium text-gray-700 mb-1">Filter by Collection:</label>
      <select id="collectionFilter" bind:value={selectedCollectionId} on:change={handleFilterChange} class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm">
        <option value="all">All History</option>
        {#each collectionsForFilter as collection (collection.id)}
          <option value={collection.id}>{collection.name}</option>
        {/each}
      </select>
    </div>
  {/if}

  {#if displayHistoryEntries && displayHistoryEntries.length > 0}
    <div class="overflow-x-auto bg-white shadow-md rounded-lg">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cards</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Streak (Max)</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each displayHistoryEntries.slice().reverse() as entry (entry.timestamp + entry.collectionId)} <!-- Reverse to show newest first -->
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.collectionName}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatTimestamp(entry.timestamp)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(entry.durationMs)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{entry.sessionType || 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm capitalize {getStatusClass(entry.status)}">{entry.status || 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {entry.correct}/{entry.totalCards}
                {#if entry.originalCollectionSize && entry.originalCollectionSize !== entry.totalCards}
                  <span class="text-xs text-gray-400"> (of {entry.originalCollectionSize})</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.score}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.longestStreak}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="text-center text-gray-500 py-8">No study history found.{selectedCollectionId !== 'all' ? ' for this collection.' : ''}</p>
  {/if}
</div>

<style>
  /* Basic styling for table, can be enhanced with Tailwind further or custom CSS */
  .container {
    max-width: 1200px;
  }
  th, td {
    text-align: left;
  }
  .capitalize {
    text-transform: capitalize;
  }
</style>
