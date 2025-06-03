// src/routes/api/flashcards/index.ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';

// GET /api/flashcards - Get all flashcards
export const GET: RequestHandler = async () => {
  try {
    const flashcards = await prisma.flashcard.findMany({
      include: { collection: true }, // Optionally include collection details
    });
    return json(flashcards);
  } catch (e) {
    console.error('Error fetching flashcards:', e);
    throw error(500, 'Failed to fetch flashcards');
  }
};

// POST /api/flashcards - Create a new flashcard
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { question, answer, imageUrl, collectionId } = body;

    if (!question || !answer) {
      throw error(400, 'Question and answer are required');
    }

    const newFlashcard = await prisma.flashcard.create({
      data: {
        question,
        answer,
        imageUrl: imageUrl || null, // Ensure null if undefined or empty string
        collectionId: collectionId || null,
      },
    });
    return json(newFlashcard, { status: 201 });
  } catch (e: any) {
    console.error('Error creating flashcard:', e);
    if (e.status) { // Forward SvelteKit errors
      throw e;
    }
    // Handle Prisma-specific errors if necessary, e.g., foreign key constraint
    if (e.code === 'P2025' && e.meta?.cause?.includes('Collection')) {
         throw error(400, `Collection with ID ${body.collectionId} not found.`);
    }
    throw error(500, 'Failed to create flashcard');
  }
};
