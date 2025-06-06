import type { LayoutServerLoad } from './$types';
import { calculateUserTotalScore } from '$lib/services/studyHistoryService';

export const load: LayoutServerLoad = async ({ locals }) => {
  let totalAccumulatedScore = 0;
  const user = locals.user ?? null;

  if (user) {
    totalAccumulatedScore = await calculateUserTotalScore(user.id);
  }

  return {
    user,
    totalAccumulatedScore
  };
};