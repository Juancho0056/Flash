interface StudySessionRecord {
	collectionId: string;
	collectionName: string;
	timestamp: number;
	totalCards: number;
	correct: number;
	incorrect: number;
	score: number;
	streak: number;
	longestStreak: number;
	durationMs: number;
	// New optional fields for more detailed session tracking
	sessionType?: 'full' | 'failed_only' | 'unanswered_only' | 'review';
	status?: 'completed' | 'mastered' | 'incomplete';
	originalCollectionSize?: number;
	sessionStartTime?: number;
}

const BASE_STORAGE_KEY = 'studyHistory';

function getHistoryStorageKey(userId?: string): string {
  return userId ? `${BASE_STORAGE_KEY}_${userId}` : BASE_STORAGE_KEY;
}

export function saveSessionToHistory(session: StudySessionRecord, userId?: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return; // SSR Guard
  console.log('Saving session to history for user:', userId || 'guest', session);
	const storageKey = getHistoryStorageKey(userId);
	const history = getStudyHistory(userId); // Fetch user-specific or guest history
	history.push(session);
	localStorage.setItem(storageKey, JSON.stringify(history));
}

export function getStudyHistory(userId?: string): StudySessionRecord[] {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []; // SSR Guard
	const storageKey = getHistoryStorageKey(userId);
	try {
		const raw = localStorage.getItem(storageKey);
		return raw ? JSON.parse(raw) : [];
	} catch (e) {
		console.error(`Error reading study history for key ${storageKey}:`, e);
		return [];
	}
}

export function getStudyHistoryByCollection(collectionId: string, userId?: string): StudySessionRecord[] {
	const allUserHistory = getStudyHistory(userId); // Gets history specific to the user or guest
	return allUserHistory.filter(entry => entry.collectionId === collectionId);
}

export function clearStudyHistory(userId?: string) {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') return; // SSR Guard
	const storageKey = getHistoryStorageKey(userId);
	localStorage.removeItem(storageKey);
	console.log(`Study history cleared for key ${storageKey}`);
}