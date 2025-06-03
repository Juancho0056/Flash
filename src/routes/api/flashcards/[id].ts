// src/routes/api/flashcards/[id].ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';

// GET /api/flashcards/:id - Get a single flashcard by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const flashcardId = params.id;
    if (!flashcardId) {
      throw error(400, 'Flashcard ID is required');
    }

    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
      include: { collection: true }, // Optionally include collection details
    });

    if (!flashcard) {
      throw error(404, 'Flashcard not found');
    }
    return json(flashcard);
  } catch (e: any) {
    console.error(`Error fetching flashcard ${params.id}:`, e);
    if (e.status) throw e;
    throw error(500, `Failed to fetch flashcard ${params.id}`);
  }
};

// PUT /api/flashcards/:id - Update a flashcard
export const PUT: RequestHandler = async ({ request, params }) => {
  try {
    const flashcardId = params.id;
    if (!flashcardId) {
      throw error(400, 'Flashcard ID is required');
    }

    const body = await request.json();
    const { question, answer, imageUrl, collectionId, timesViewed, timesCorrect } = body;

    if (question !== undefined && !question) throw error(400, 'Question cannot be empty');
    if (answer !== undefined && !answer) throw error(400, 'Answer cannot be empty');

    const dataToUpdate: any = {};
    if (question !== undefined) dataToUpdate.question = question;
    if (answer !== undefined) dataToUpdate.answer = answer;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl === '' ? null : imageUrl;
    if (collectionId !== undefined) dataToUpdate.collectionId = collectionId === '' ? null : collectionId;
    if (timesViewed !== undefined) dataToUpdate.timesViewed = Number(timesViewed);
    if (timesCorrect !== undefined) dataToUpdate.timesCorrect = Number(timesCorrect);

    if (Object.keys(dataToUpdate).length === 0) {
        throw error(400, 'No update data provided');
    }

    // Prisma's @updatedAt directive should handle this automatically.
    // dataToUpdate.updatedAt = new Date();

    const updatedFlashcard = await prisma.flashcard.update({
      where: { id: flashcardId },
      data: dataToUpdate,
    });
    return json(updatedFlashcard);
  } catch (e: any) {
    console.error(`Error updating flashcard ${params.id}:`, e);
    if (e.status) throw e;
    if (e.code === 'P2025') {
      // Check if it's the main record or a related one like collection
      if (e.meta?.cause?.includes('Record to update not found')) {
        throw error(404, `Flashcard with ID ${params.id} not found for update.`);
      } else if (e.meta?.cause?.includes('Collection')) {
        throw error(400, `Collection with ID ${body.collectionId} not found.`);
      }
       throw error(404, `Failed to update flashcard ${params.id}. Record or related record not found.`);
    }
    throw error(500, `Failed to update flashcard ${params.id}`);
  }
};

// DELETE /api/flashcards/:id - Delete a flashcard
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const flashcardId = params.id;
    if (!flashcardId) {
      throw error(400, 'Flashcard ID is required');
    }

    await prisma.flashcard.delete({
      where: { id: flashcardId },
    });
    return json({ message: 'Flashcard deleted successfully' }, { status: 200 });
  } catch (e: any) {
    console.error(`Error deleting flashcard ${params.id}:`, e);
    if (e.status) throw e;
    if (e.code === 'P2025') {
      throw error(404, `Flashcard with ID ${params.id} not found for deletion.`);
    }
    throw error(500, `Failed to delete flashcard ${params.id}`);
  }
};
