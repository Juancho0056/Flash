// src/routes/api/collections/index.ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';
import { Prisma } from '@prisma/client';
import { $Enums } from '@prisma/client';
interface PrismaError {
	code?: string;
	meta?: {
		target?: string[]; // según Prisma, meta.target es un array de strings
	};
}

interface SvelteKitError extends Error {
	status?: number;
}

// GET /api/collections - Get all collections
export const GET: RequestHandler = async (event) => {
	try {
		const userId = event.locals.user?.id;
		let masteredCollectionIds = new Set<string>();
		const collectionLastStudiedMap = new Map<string, string>();
		console.log('userid',userId);
		if (userId) {
			// Fetch mastered collection IDs
			const sessions = await prisma.studySessionRecord.findMany({
				where: {
					userId,
					status: 'COMPLETED'
				},
				select: {
					originalCollectionId: true,
					correctAnswers: true,
					incorrectAnswers: true,
					originalCollectionSize: true
				}
			});

			masteredCollectionIds = new Set(
				sessions
					.filter(
						(session) =>
							session.correctAnswers === session.originalCollectionSize &&
							session.incorrectAnswers === 0
					)
					.map((session) => session.originalCollectionId)
			);
			console.log('masteredCollectionIds', masteredCollectionIds);

			// Fetch last studied times
			const lastStudiedSessions = await prisma.studySessionRecord.groupBy({
				by: ['originalCollectionId'],
				where: { userId: userId },
				_max: { sessionEndTime: true },
			});
			lastStudiedSessions.forEach(record => {
				if (record._max.sessionEndTime) {
					collectionLastStudiedMap.set(record.originalCollectionId, record._max.sessionEndTime.toISOString());
				}
			});
		}

		const collections = await prisma.collection.findMany({
			include: { _count: { select: { flashcards: true } } },
		});

		const collectionsWithDetails = collections.map(collection => ({
			...collection,
			isMastered: userId ? masteredCollectionIds.has(collection.id) : false,
			lastStudiedIso: collectionLastStudiedMap.get(collection.id) || null,
		}));

		return json(collectionsWithDetails);
	} catch (e: unknown) {
		console.error('Error fetching collections:', e);
		throw error(500, 'Failed to fetch collections');
	}
};

// POST /api/collections - Create a new collection
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: { name?: string; cefrLevel?: string } = await request.json();
		const { name, cefrLevel } = body;

		if (!name) {
			throw error(400, 'Collection name is required');
		}

		let cefrValue: $Enums.CefrLevel | undefined = undefined;
		if (cefrLevel) {
			if (!Object.values($Enums.CefrLevel).includes(cefrLevel as $Enums.CefrLevel)) {
				throw error(400, 'Invalid CEFR level. Must be one of: A1, A2, B1, B2, C1, C2');
			}
			cefrValue = cefrLevel as $Enums.CefrLevel;
		}

		const createData: Prisma.CollectionCreateInput = {
			name,
			cefrLevel: cefrValue
		};

		const newCollection = await prisma.collection.create({
			data: createData
		});

		return json(newCollection, { status: 201 });
	} catch (e: unknown) {
		console.error('Error creating collection:', e);

		// Si es un error de SvelteKit con status
		if (e instanceof Error && 'status' in e && typeof (e as SvelteKitError).status === 'number') {
			throw e;
		}

		// Si es un error de Prisma por conflicto único
		if (
			typeof e === 'object' &&
			e !== null &&
			(codeIs(e, 'P2002')) &&
			hasNameConstraint(e)
		) {
			throw error(409, 'Collection name already exists.');
		}

		throw error(500, 'Failed to create collection');
	}
};

// Helpers
function codeIs(e: unknown, expected: string): e is PrismaError {
	return typeof e === 'object' && e !== null && 'code' in e && (e as PrismaError).code === expected;
}

function hasNameConstraint(e: unknown): e is PrismaError {
	if (
		typeof e === 'object' &&
		e !== null &&
		'meta' in e
	) {
		const meta = (e as PrismaError).meta;
		if (meta && Array.isArray(meta.target)) {
			return meta.target.includes('name');
		}
	}
	return false;
}