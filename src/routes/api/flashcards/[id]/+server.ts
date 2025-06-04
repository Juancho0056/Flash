// src/routes/api/flashcards/[id].ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit'; // json might not be needed if only error is used from here for DELETE

// GET /api/flashcards/:id - Get a single flashcard by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const flashcardId = params.id;
    if (!flashcardId) {
      throw error(400, 'Flashcard ID is required');
    }

    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
      include: { collection: true },
    });

    if (!flashcard) {
      throw error(404, 'Flashcard not found');
    }
    return json(flashcard); // json is used here
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
    // Destructure new field isDifficult
    const { question, answer, imageUrl, collectionId, timesViewed, timesCorrect, isDifficult } = body;

    if (question !== undefined && !question) throw error(400, 'Question cannot be empty');
    if (answer !== undefined && !answer) throw error(400, 'Answer cannot be empty');

    const dataToUpdate: any = {};
    if (question !== undefined) dataToUpdate.question = question;
    if (answer !== undefined) dataToUpdate.answer = answer;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl === '' ? null : imageUrl;
    if (collectionId !== undefined) dataToUpdate.collectionId = collectionId === '' ? null : collectionId;
    if (timesViewed !== undefined) dataToUpdate.timesViewed = Number(timesViewed);
    if (timesCorrect !== undefined) dataToUpdate.timesCorrect = Number(timesCorrect);
    // Add isDifficult to dataToUpdate if present in request
    if (isDifficult !== undefined) {
      dataToUpdate.isDifficult = Boolean(isDifficult);
    }

    if (Object.keys(dataToUpdate).length === 0) {
        throw error(400, 'No update data provided');
    }

    const updatedFlashcard = await prisma.flashcard.update({
      where: { id: flashcardId },
      data: dataToUpdate,
    });
    return json(updatedFlashcard); // json is used here
  } catch (e: any) {
    console.error(`Error updating flashcard ${params.id}:`, e);
    if (e.status) throw e;
    if (e.code === 'P2025') {
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
    // Return a 204 No Content response
    return new Response(null, { status: 204 });
  } catch (e: any) {
    console.error(`Error deleting flashcard ${params.id}:`, e);
    if (e.status) throw e; // Forward SvelteKit errors
    if (e.code === 'P2025') { // Prisma error for record not found
      throw error(404, `Flashcard with ID ${params.id} not found for deletion.`);
    }
    throw error(500, `Failed to delete flashcard ${params.id}`);
  }
};
