import  type { StudyStats } from '$lib/stores/studyStats'; // Adjust the import path as necessary

// src/lib/services/badgeService.ts
export enum BadgeId {
  FIRST_SESSION_COMPLETED = 'firstSessionCompleted',
  TEN_CORRECT_IN_SESSION = 'tenCorrectInSession',
  COLLECTION_MASTERED = 'collectionMastered',
  STREAK_5 = 'streak5',
  STREAK_10 = 'streak10',
  CORRECT_50 = 'correct50',
}

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // Placeholder for an icon, e.g., an emoji or SVG path
  unlocked: boolean;
  unlockedTimestamp?: number;
}

const BADGES_STORAGE_KEY = 'unlocked_badges';

// (Continuing in src/lib/services/badgeService.ts)
export const allBadges: Badge[] = [
  {
    id: BadgeId.FIRST_SESSION_COMPLETED,
    name: 'Session Starter',
    description: 'Completed your first study session.',
    icon: '🎉',
    unlocked: false,
  },
  {
    id: BadgeId.TEN_CORRECT_IN_SESSION,
    name: 'Correct Streak',
    description: 'Answered 10 cards correctly in a single session.',
    icon: '🎯',
    unlocked: false,
  },
  {
    id: BadgeId.COLLECTION_MASTERED,
    name: 'Collection Master',
    description: 'Answered all cards in a collection correctly in one session.',
    icon: '🏆',
    unlocked: false,
  },
  {
    id: BadgeId.STREAK_5,
    name: 'Streak Novice',
    description: 'Answered 5 cards correctly in a row.',
    icon: '🔥',
    unlocked: false,
  },
  {
    id: BadgeId.STREAK_10,
    name: 'Streak Pro',
    description: 'Answered 10 cards correctly in a row.',
    icon: '🔥🔥',
    unlocked: false,
  },
  {
    id: BadgeId.CORRECT_50,
    name: 'Knowledge Builder',
    description: 'Answered 50 cards correctly in total.',
    icon: '📚',
    unlocked: false,
  },
];

// (Continuing in src/lib/services/badgeService.ts)
import { writable, get } from 'svelte/store'; // Use get for synchronous access if needed outside components
import {toast} from '$lib/toastStore'; // Assuming toastStore is in this path

// Writable store to hold the state of badges, initialized from localStorage
export const unlockedBadges = writable<Badge[]>(loadBadges());

function loadBadges(): Badge[] {
  if (typeof window === 'undefined') return allBadges.map(b => ({...b, unlocked: false})); // SSR guard

  const storedBadgesJson = localStorage.getItem(BADGES_STORAGE_KEY);
  let storedBadgeStates: Partial<Record<BadgeId, { unlocked: boolean; unlockedTimestamp?: number }>> = {};
  if (storedBadgesJson) {
    try {
      storedBadgeStates = JSON.parse(storedBadgesJson);
    } catch (e) {
      console.error('Error parsing stored badges:', e);
      localStorage.removeItem(BADGES_STORAGE_KEY); // Clear corrupted data
    }
  }
  // Merge with default badge definitions
  // Ensure all badges from allBadges are represented, even if not in storage yet
  const loadedBadges = allBadges.map(defaultBadge => {
    const storedState = storedBadgeStates[defaultBadge.id];
    return {
      ...defaultBadge,
      unlocked: storedState?.unlocked || false,
      unlockedTimestamp: storedState?.unlockedTimestamp,
    };
  });
  return loadedBadges;
}

function saveBadges(badgesToSave: Badge[]) {
  if (typeof window === 'undefined') return; // SSR guard

  const statesToStore: Partial<Record<BadgeId, { unlocked: boolean; unlockedTimestamp?: number }>> = {};
  badgesToSave.forEach(badge => {
    if (badge.unlocked) {
      statesToStore[badge.id] = { unlocked: true, unlockedTimestamp: badge.unlockedTimestamp };
    }
  });
  localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(statesToStore));
}

export function awardBadge(badgeId: BadgeId): boolean {
  let awardedNow = false;
  unlockedBadges.update(currentBadges => {
    const badgeIndex = currentBadges.findIndex(b => b.id === badgeId);
    if (badgeIndex !== -1 && !currentBadges[badgeIndex].unlocked) {
      currentBadges[badgeIndex].unlocked = true;
      currentBadges[badgeIndex].unlockedTimestamp = Date.now();
      saveBadges(currentBadges);

      // Show toast notification
      toast.success(
        `Badge Unlocked: ${currentBadges[badgeIndex].name}! ${currentBadges[badgeIndex].icon}`,
        5000 // 5 seconds
      );
      awardedNow = true;
    }
    return currentBadges;
  });
  return awardedNow; // Return true if badge was awarded in this call
}

// Function to get all badges (useful for a profile/badges page later)
export function getAllBadges(): Badge[] {
  return get(unlockedBadges);
}

// Helper function to check if a specific badge is unlocked
export function isBadgeUnlocked(badgeId: BadgeId): boolean {
  const badges = get(unlockedBadges);
  const badge = badges.find(b => b.id === badgeId);
  return badge?.unlocked || false;
}

// Placeholder for a function to reset all badges (for testing)
export function resetAllBadges_TESTONLY() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(BADGES_STORAGE_KEY);
    unlockedBadges.set(allBadges.map(b => ({...b, unlocked: false, unlockedTimestamp: undefined})));
    console.log('All badges reset for testing.');
  }
}

// Initial load when service is imported
if (typeof window !== 'undefined') {
    // This ensures unlockedBadges store is updated from localStorage as soon as possible.
    // loadBadges() is already called at writable initialization, so this might be redundant unless there's an issue with timing.
    // For safety, an explicit update can be done, or rely on the writable's initializer.
    // unlockedBadges.set(loadBadges());
}

export function checkAndAwardBadgesFromStats(stats: StudyStats): void {
  // This function is currently not awarding badges directly, as specific trigger points
  // in studyStore.ts (e.g., after a card is answered, or a session ends)
  // provide more precise contexts for awarding most badges.

  // If there were badges that could ONLY be determined by looking at a completed
  // session's stats in isolation (and not during the session itself),
  // this function could be a place for them.
  // For now, it remains empty to avoid duplicate or conflicting badge awards.
  // Example:
  // if (stats.someSpecificCondition) {
  //   awardBadge(BadgeId.SOME_OTHER_BADGE);
  // }
}