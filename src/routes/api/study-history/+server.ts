// src/routes/api/study-history/+server.ts
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';
import { SessionType, SessionStatus } from '@prisma/client';
import { z } from 'zod';

// Zod schema para validar entrada con enums y tipos correctos
const studySessionSchema = z.object({
	originalCollectionId: z.string().min(1),
	collectionName: z.string().min(1),
	sessionStartTime: z.number(),
	sessionEndTime: z.number(),
	durationMs: z.number(),
	cardsInView: z.number(),
	originalCollectionSize: z.number().optional(),
	cardsAttempted: z.number().optional(),
	correct: z.number(),
	incorrect: z.number(),
	score: z.number(),
	streak: z.number(),
	longestStreak: z.number(),
	sessionType: z.nativeEnum(SessionType),
	status: z.nativeEnum(SessionStatus)
});

export async function POST(event: RequestEvent) {
	const { locals } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	let parsed;
	try {
		const body = await event.request.json();
		parsed = studySessionSchema.parse(body); // validación y tipado fuerte
	} catch (err) {
		console.error('Invalid request body', err);
		throw error(400, 'Invalid request body or enum values.');
	}

	try {
		const newRecord = await prisma.studySessionRecord.create({
			data: {
				userId: locals.user.id,
				originalCollectionId: parsed.originalCollectionId,
				collectionName: parsed.collectionName,
				originalCollectionSize: parsed.originalCollectionSize ?? 0,
				sessionStartTime: new Date(parsed.sessionStartTime),
				sessionEndTime: new Date(parsed.sessionEndTime),
				durationMs: parsed.durationMs,
				cardsInView: parsed.cardsInView,
				cardsAttempted: parsed.cardsAttempted,
				correctAnswers: parsed.correct,
				incorrectAnswers: parsed.incorrect,
				score: parsed.score,
				finalStreak: parsed.streak,
				longestStreakInSession: parsed.longestStreak,
				sessionType: parsed.sessionType,
				status: parsed.status
			}
		});

		return json(newRecord, { status: 201 });
	} catch (e) {
		console.error('Failed to create study session record:', e);
		throw error(500, 'Could not save study session.');
	}
}

export async function GET(event: RequestEvent) {
	const { locals, url } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	const originalCollectionId = url.searchParams.get('originalCollectionId');
	const whereClause = {
		userId: locals.user.id,
		...(originalCollectionId && { originalCollectionId })
	};

	try {
		const records = await prisma.studySessionRecord.findMany({
			where: whereClause,
			orderBy: {
				sessionEndTime: 'desc'
			}
		});
		return json(records);
	} catch (e) {
		console.error('Failed to fetch study session records:', e);
		throw error(500, 'Could not retrieve study sessions.');
	}
}
