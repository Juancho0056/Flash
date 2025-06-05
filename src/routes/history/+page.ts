import * as studyHistoryService from '$lib/services/studyHistoryService';
import type { Collection } from '@prisma/client'; // Assuming Collection type is available
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  try {
    // Fetch all study history entries
    // studyHistoryService functions run client-side due to localStorage,
    // so we can call them directly if this load function runs on the client,
    // or we'd need an API endpoint if it must run server-side.
    // For now, assuming client-side fetching is fine for history page or it's handled by service.
    // If getStudyHistory can only run client-side, we might need to load it in onMount in +page.svelte
    // However, a load function should ideally fetch data. Let's assume getStudyHistory is safe here for now.
    // If not, this will be adjusted.
    const historyEntries = studyHistoryService.getStudyHistory();

    // Fetch all collections for the filter dropdown
    let collections: Collection[] = [];
    const response = await fetch('/api/collections'); // Use the existing API endpoint
    if (response.ok) {
      collections = await response.json();
    } else {
      console.error('Failed to fetch collections for history filter:', response.statusText);
      // Proceed without collections if fetching fails, filter will be disabled or limited
    }

    return {
      historyEntries,
      collections,
      title: 'Study History' // SEO and tab title
    };
  } catch (error) {
    console.error('Error loading study history page data:', error);
    return {
      historyEntries: [],
      collections: [],
      title: 'Study History',
      error: 'Could not load study history data.'
    };
  }
};
