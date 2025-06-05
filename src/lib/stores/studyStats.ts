import { writable } from 'svelte/store';

export interface StudyStats {
  totalViewed: number;
  totalCorrect: number;
  totalIncorrect: number;
  correctStreak: number;
  longestStreak: number;
  difficultAnswered: number;
  badgesUnlocked: string[];
}

export const studyStats = writable<StudyStats>({
  totalViewed: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  correctStreak: 0,
  longestStreak: 0,
  difficultAnswered: 0,
  badgesUnlocked: []
});
