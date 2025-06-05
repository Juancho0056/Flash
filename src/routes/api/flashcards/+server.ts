// src/routes/api/flashcards/index.ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';
interface PrismaError {
	code?: string;
	meta?: {
		cause?: string;
		field_name?: string;
	};
	status?: number;
}
// GET /api/flashcards - Get all flashcards or filter by collectionId
export const GET: RequestHandler = async ({ url }) => {
  try {
    const collectionId = url.searchParams.get('collectionId');

    let flashcards;
    if (collectionId) {
      // First, check if the collection itself exists to provide a clearer error
      const collection = await prisma.collection.findUnique({
        where: { id: collectionId },
      });
      if (!collection) {
        throw error(404, `Collection with ID ${collectionId} not found.`);
      }

      flashcards = await prisma.flashcard.findMany({
        where: { collectionId: collectionId },
        include: { collection: true }, // Still useful to confirm collection details per card
        orderBy: { createdAt: 'desc' } // Optional: order flashcards
      });
    } else {
      flashcards = await prisma.flashcard.findMany({
        include: { collection: true },
        orderBy: { createdAt: 'desc' } // Optional: order flashcards
      });
    }
    return json(flashcards);
  } catch (e: unknown) {
    console.error('Error fetching flashcards :', e);

    if (e && typeof e === 'object' && 'status' in e) {
      throw e as { status: number }; 
    }

    throw error(500, 'Failed to fetch flashcards.');
  }
};

// POST /api/flashcards - Create a new flashcard
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json(); // se mueve fuera del try para usar en el catch si falla Prisma

	try {
		const { question, answer, imageUrl, collectionId } = body;

		if (!question || !answer) {
			throw error(400, 'Question and answer are required');
		}

		const newFlashcard = await prisma.flashcard.create({
			data: {
				question,
				answer,
				imageUrl: imageUrl || null,
				collectionId: collectionId || null
			}
		});

		return json(newFlashcard, { status: 201 });
	} catch (e: unknown) {
		console.error('Error creating flashcard:', e);

		if (typeof e === 'object' && e !== null) {
			const err = e as PrismaError;

			if (err.status) {
				throw error(err.status, 'Unexpected error');
			}

			if (err.code === 'P2025' && err.meta?.cause?.includes('Collection')) {
				throw error(400, `Collection with ID ${body.collectionId} not found.`);
			}

			if (err.code === 'P2003' && err.meta?.field_name?.includes('collectionId')) {
				throw error(400, `Collection with ID ${body.collectionId} not found.`);
			}
		}

		throw error(500, 'Failed to create flashcard');
	}
};