// src/routes/api/user-flashcard-sm2/+server.ts
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';

const DEFAULT_EF = 2.5;

interface SM2CalculationParams {
	easinessFactor: number;
	repetitions: number;
	intervalDays: number;
}

interface UpdateSM2ApiPayload {
	flashcardId: string;
	collectionId: string;
	collectionName?: string;
	quality: number;
}

function calculateSM2Core(
	current: SM2CalculationParams | null,
	quality: number
): SM2CalculationParams {
	let { easinessFactor, repetitions, intervalDays } = current || {
		easinessFactor: DEFAULT_EF,
		repetitions: 0,
		intervalDays: 0
	};

	if (quality < 0 || quality > 5) {
		console.warn(`Quality ${quality} out of bounds, clamping to 0-5.`);
		quality = Math.max(0, Math.min(5, quality));
	}

	easinessFactor = Math.max(1.3, easinessFactor - 0.8 + 0.28 * quality - 0.02 * quality * quality);

	if (quality < 3) {
		repetitions = 0;
		intervalDays = 1;
	} else {
		repetitions += 1;
		if (repetitions === 1) {
			intervalDays = 1;
		} else if (repetitions === 2) {
			intervalDays = 6;
		} else {
			intervalDays = Math.ceil((intervalDays || 1) * easinessFactor);
		}
	}

	return { easinessFactor, repetitions, intervalDays };
}

export async function POST(event: RequestEvent) {
	const { locals } = event;
	if (!locals.user) throw error(401, 'Unauthorized');
	const userId = locals.user.id;

	let payload: UpdateSM2ApiPayload;
	try {
		payload = await event.request.json();
	} catch {
		throw error(400, 'Invalid request body: Could not parse JSON.');
	}

	const { flashcardId, collectionId, quality, collectionName } = payload;

	if (!flashcardId || !collectionId || typeof quality !== 'number') {
		throw error(400, 'Missing required fields (flashcardId, collectionId, quality).');
	}
	if (quality < 0 || quality > 5) {
		throw error(400, 'Invalid quality score. Must be between 0 and 5.');
	}

	try {
		const existing = await prisma.userFlashcardSM2.findUnique({
			where: {
				userId_flashcardId: { userId, flashcardId }
			}
		});

		const sm2Input: SM2CalculationParams | null = existing
			? {
					easinessFactor: existing.easinessFactor,
					repetitions: existing.repetitions,
					intervalDays: existing.intervalDays
				}
			: null;

		const newValues = calculateSM2Core(sm2Input, quality);
		const now = new Date();
		const dueDate = new Date(now.getTime() + newValues.intervalDays * 86_400_000);

		const upserted = await prisma.userFlashcardSM2.upsert({
			where: {
				userId_flashcardId: { userId, flashcardId }
			},
			create: {
				userId,
				flashcardId,
				easinessFactor: newValues.easinessFactor,
				repetitions: newValues.repetitions,
				intervalDays: newValues.intervalDays,
				dueDate,
				lastReviewed: now,
				originalCollectionId: collectionId,
				collectionName
			},
			update: {
				easinessFactor: newValues.easinessFactor,
				repetitions: newValues.repetitions,
				intervalDays: newValues.intervalDays,
				dueDate,
				lastReviewed: now,
				originalCollectionId: collectionId,
				collectionName
			}
		});

		return json(upserted, { status: 200 });
	} catch (err: unknown) {
		console.error(`Failed to update SM2 data for card ${flashcardId}:`, err);

		if (isPrismaError(err)) {
			if (
                err.code === 'P2003' &&
                typeof err.meta?.field_name === 'string' &&
                err.meta.field_name.includes('flashcardId')
            ) {
                throw error(400, `Flashcard with ID ${flashcardId} not found or invalid.`);
            }
			if (err.code === 'P2003') {
				throw error(400, `Data integrity issue: ${err.meta?.field_name || 'related record not found'}.`);
			}
		}

		throw error(500, 'Could not update SM2 data.');
	}
}

export async function GET(event: RequestEvent) {
	const { locals, url } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	const userId = locals.user.id;
	const flashcardId = url.searchParams.get('flashcardId');

	if (!flashcardId) {
		throw error(400, 'Missing flashcardId query parameter.');
	}

	try {
		const record = await prisma.userFlashcardSM2.findUnique({
			where: {
				userId_flashcardId: { userId, flashcardId }
			}
		});
		if (!record) {
			return json({ message: 'SM2 record not found for this user and flashcard.' }, { status: 404 });
		}
		return json(record);
	} catch (err: unknown) {
		console.error(`Failed to get SM2 data for card ${flashcardId}:`, err);
		throw error(500, 'Could not retrieve SM2 data.');
	}
}

export async function DELETE(event: RequestEvent) {
	const { locals, url } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	const userId = locals.user.id;
	const flashcardId = url.searchParams.get('flashcardId');

	if (!flashcardId) {
		throw error(400, 'Missing flashcardId query parameter.');
	}

	try {
		await prisma.userFlashcardSM2.delete({
			where: {
				userId_flashcardId: { userId, flashcardId }
			}
		});
		return new Response(null, { status: 204 });
	} catch (err: unknown) {
		if (isPrismaError(err) && err.code === 'P2025') {
			throw error(404, 'SM2 record not found to delete for this user and flashcard.');
		}
		console.error(`Failed to delete SM2 data for card ${flashcardId} for user ${userId}:`, err);
		throw error(500, 'Could not delete SM2 data.');
	}
}

// ✅ Helper to narrow down PrismaClientKnownRequestError safely
function isPrismaError(err: unknown): err is import('@prisma/client/runtime/library').PrismaClientKnownRequestError {
	return typeof err === 'object' && err !== null && 'code' in err;
}
