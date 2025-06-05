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
	durationMs: number; // opcional si deseas medirlo
}

const STORAGE_KEY = 'studyHistory';

export function saveSessionToHistory(session: StudySessionRecord) {
    console.log('Saving session to history:', session);
	const history = getStudyHistory();
	history.push(session);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getStudyHistory(): StudySessionRecord[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

export function clearStudyHistory() {
	localStorage.removeItem(STORAGE_KEY);
}