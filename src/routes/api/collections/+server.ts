// src/routes/api/collections/index.ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';

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
export const GET: RequestHandler = async () => {
	try {
		const collections = await prisma.collection.findMany({
			include: { _count: { select: { flashcards: true } } },
		});
		return json(collections);
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

		const createData: { name: string; cefrLevel?: string } = {
			name: name,
		};

		if (cefrLevel) {
			// Basic validation could be done here, e.g. check if cefrLevel is one of "A1", "A2", etc.
			// For now, assuming client sends valid string or Prisma handles enum conversion/error.
			createData.cefrLevel = cefrLevel;
		}

		const newCollection = await prisma.collection.create({
			data: createData,
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