// src/routes/api/user-progress/+server.ts
import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';
import type { UserProgressPayload } from '$lib/services/progressService';

type UserProgressApiPayload = UserProgressPayload;

export async function POST(event: RequestEvent) {
	const { locals } = event;
	console.log(locals);
	if (!locals.user) throw error(401, 'Unauthorized');
	const userId = locals.user.id;

	let payload: UserProgressApiPayload;
	try {
		payload = await event.request.json();
	} catch {
		throw error(400, 'Invalid request body: Could not parse JSON.');
	}

	if (!payload.collectionId) {
		throw error(400, 'Missing collectionId in request payload.');
	}
	if (typeof payload.sessionStartTime !== 'number') {
		throw error(400, 'Invalid or missing sessionStartTime in request payload.');
	}

	const originalCollectionId = payload.collectionId;
	const sessionStartTimeDate = new Date(payload.sessionStartTime);

	const dataToUpsert = {
		userId,
		originalCollectionId,
		currentIndex: payload.currentIndex,
		correctAnswers: payload.correctAnswers,
		incorrectAnswers: payload.incorrectAnswers,
		currentScore: payload.currentScore,
		sessionCompleted: payload.sessionCompleted,
		flashcardsState: payload.flashcardsState as unknown as Prisma.InputJsonValue,
        studyStats: payload.studyStats as unknown as Prisma.InputJsonValue,
		sessionStartTime: sessionStartTimeDate
	};

	try {
		const progress = await prisma.userStudyProgress.upsert({
			where: {
				userId_originalCollectionId: { userId, originalCollectionId }
			},
			create: dataToUpsert,
			update: {
				currentIndex: payload.currentIndex,
				correctAnswers: payload.correctAnswers,
				incorrectAnswers: payload.incorrectAnswers,
				currentScore: payload.currentScore,
				sessionCompleted: payload.sessionCompleted,
				flashcardsState: payload.flashcardsState as unknown as Prisma.InputJsonValue,
                studyStats: payload.studyStats as unknown as Prisma.InputJsonValue,
				sessionStartTime: sessionStartTimeDate,
				lastSavedTimestamp: new Date()
			}
		});
		return json(progress, { status: 200 });
	} catch (err: unknown) {
		console.error('Failed to save user study progress:', err);
		throw error(500, 'Could not save study progress.');
	}
}

export async function GET(event: RequestEvent) {
	const { locals, url } = event;
	console.log('Locals', locals);
	if (!locals.user) throw error(401, 'Unauthorized');

	const userId = locals.user.id;
	const originalCollectionId = url.searchParams.get('originalCollectionId');
	console.log(originalCollectionId);
	if (!originalCollectionId) {
		throw error(400, 'Missing originalCollectionId query parameter.');
	}

	try {
		const progress = await prisma.userStudyProgress.findUnique({
			where: {
				userId_originalCollectionId: { userId, originalCollectionId }
			}
		});
		console.log(progress);
		if (!progress) {
			return json(null, { status: 404 });
		}

		return json(progress);
	} catch (err: unknown) {
		console.error('Failed to load user study progress:', err);
		throw error(500, 'Could not load study progress.');
	}
}

export async function DELETE(event: RequestEvent) {
	const { locals, url } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	const userId = locals.user.id;
	const originalCollectionId = url.searchParams.get('originalCollectionId');

	if (!originalCollectionId) {
		throw error(400, 'Missing originalCollectionId query parameter.');
	}

	try {
		await prisma.userStudyProgress.delete({
			where: {
				userId_originalCollectionId: { userId, originalCollectionId }
			}
		});
		return new Response(null, { status: 204 });
	} catch (err: unknown) {
		if (isPrismaError(err) && err.code === 'P2025') {
			throw error(404, 'Study progress not found to delete.');
		}
		console.error('Failed to delete user study progress:', err);
		throw error(500, 'Could not delete study progress.');
	}
}

// ✅ Utilidad para verificar si es error conocido de Prisma
function isPrismaError(err: unknown): err is import('@prisma/client/runtime/library').PrismaClientKnownRequestError {
	return typeof err === 'object' && err !== null && 'code' in err;
}
