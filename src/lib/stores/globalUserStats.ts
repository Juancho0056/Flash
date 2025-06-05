import { writable } from 'svelte/store';

const GLOBAL_STATS_STORAGE_KEY = 'global_user_stats';

export interface GlobalUserStats {
  totalCorrectAnswersAllTime: number;
  // Future global stats can be added here
  // e.g., totalCardsStudiedAllTime, totalSessionsCompletedAllTime
}

function loadGlobalStats(): GlobalUserStats {
  if (typeof window === 'undefined') {
    return { totalCorrectAnswersAllTime: 0 }; // SSR Guard
  }
  const storedStatsJson = localStorage.getItem(GLOBAL_STATS_STORAGE_KEY);
  if (storedStatsJson) {
    try {
      const parsedStats = JSON.parse(storedStatsJson);
      return {
        totalCorrectAnswersAllTime: parsedStats.totalCorrectAnswersAllTime || 0,
      };
    } catch (e) {
      console.error('Error parsing global user stats:', e);
      localStorage.removeItem(GLOBAL_STATS_STORAGE_KEY); // Clear corrupted data
      return { totalCorrectAnswersAllTime: 0 };
    }
  }
  return { totalCorrectAnswersAllTime: 0 };
}

const initialState: GlobalUserStats = loadGlobalStats();

export const globalUserStats = writable<GlobalUserStats>(initialState);

export function incrementTotalCorrectAnswersAllTime(): void {
  globalUserStats.update(stats => {
    stats.totalCorrectAnswersAllTime += 1;
    if (typeof window !== 'undefined') {
      localStorage.setItem(GLOBAL_STATS_STORAGE_KEY, JSON.stringify(stats));
    }
    return stats;
  });
}

// Optional: A way to get a snapshot if needed outside Svelte components, though get(globalUserStats) is preferred.
// export function getCurrentGlobalStats(): GlobalUserStats {
//   let currentStats!: GlobalUserStats;
//   globalUserStats.subscribe(value => currentStats = value)(); // Immediate subscribe & unsubscribe
//   return currentStats;
// }
