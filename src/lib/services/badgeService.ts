// src/lib/services/badgeService.ts
export enum BadgeId {
  FIRST_SESSION_COMPLETED = 'firstSessionCompleted',
  TEN_CORRECT_IN_SESSION = 'tenCorrectInSession',
  COLLECTION_MASTERED = 'collectionMastered', // e.g., 100% correct in a session
  // Add more badge IDs as needed
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
];

// (Continuing in src/lib/services/badgeService.ts)
import { writable, get } from 'svelte/store'; // Use get for synchronous access if needed outside components
import { toastStore } from '$lib/toastStore'; // Assuming toastStore is in this path

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
  return allBadges.map(badge => ({
    ...badge,
    unlocked: storedBadgeStates[badge.id]?.unlocked || false,
    unlockedTimestamp: storedBadgeStates[badge.id]?.unlockedTimestamp,
  }));
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
      toastStore.addToast({
        type: 'success',
        message: `Badge Unlocked: ${currentBadges[badgeIndex].name}! ${currentBadges[badgeIndex].icon}`,
        duration: 5000 // 5 seconds
      });
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
