import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';
import type { Prisma } from '@prisma/client';

interface PrismaError {
	code?: string;
	meta?: {
		cause?: string;
	};
	status?: number;
}

function isPrismaError(e: unknown): e is PrismaError {
	return typeof e === 'object' && e !== null && 'code' in e;
}

// GET /api/flashcards/:id
export const GET: RequestHandler = async ({ params }) => {
	try {
		const flashcardId = params.id;
		if (!flashcardId) throw error(400, 'Flashcard ID is required');

		const flashcard = await prisma.flashcard.findUnique({
			where: { id: flashcardId },
			include: { collection: true }
		});

		if (!flashcard) throw error(404, 'Flashcard not found');
		return json(flashcard);
	} catch (e) {
		console.error(`Error fetching flashcard ${params.id}:`, e);
		if (isPrismaError(e) && e.status) throw e;
		throw error(500, `Failed to fetch flashcard ${params.id}`);
	}
};

// PUT /api/flashcards/:id
export const PUT: RequestHandler = async ({ request, params }) => {
	try {
		const flashcardId = params.id;
		if (!flashcardId) throw error(400, 'Flashcard ID is required');

		const body: Partial<{
			question: string;
			answer: string;
			pronunciation: string;
			example: string;
			imageUrl: string | null;
			collectionId: string | null;
			timesViewed: number;
			timesCorrect: number;
			isDifficult: boolean;
		}> = await request.json();

		const {
			question,
			answer,
			pronunciation,
			example,
			imageUrl,
			collectionId,
			timesViewed,
			timesCorrect,
			isDifficult
		} = body;

		if (question !== undefined && !question) throw error(400, 'Question cannot be empty');
		if (answer !== undefined && !answer) throw error(400, 'Answer cannot be empty');

		const dataToUpdate: Prisma.FlashcardUpdateInput = {};
		if (question !== undefined) dataToUpdate.question = question;
		if (answer !== undefined) dataToUpdate.answer = answer;
		if (pronunciation !== undefined) dataToUpdate.pronunciation = pronunciation;
		if (example !== undefined) dataToUpdate.example = example;
		if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl === '' ? null : imageUrl;
		if (timesViewed !== undefined) dataToUpdate.timesViewed = Number(timesViewed);
		if (timesCorrect !== undefined) dataToUpdate.timesCorrect = Number(timesCorrect);
		if (isDifficult !== undefined) dataToUpdate.isDifficult = isDifficult;
		if (collectionId !== undefined) {
			if (collectionId === '') {
				dataToUpdate.collection = { disconnect: true };
			} else if (typeof collectionId === 'string') {
				dataToUpdate.collection = { connect: { id: collectionId as string } };
			}
		}

		if (Object.keys(dataToUpdate).length === 0)
			throw error(400, 'No update data provided');

		const updatedFlashcard = await prisma.flashcard.update({
			where: { id: flashcardId },
			data: dataToUpdate
		});

		return json(updatedFlashcard);
	} catch (e) {
		console.error(`Error updating flashcard ${params.id}:`, e);
		if (isPrismaError(e)) {
			if (e.status) throw e;
			if (e.code === 'P2025') {
				const cause = e.meta?.cause ?? '';
				if (cause.includes('Record to update not found')) {
					throw error(404, `Flashcard with ID ${params.id} not found for update.`);
				}
				if (cause.includes('Collection')) {
					throw error(400, `Collection with ID "${(await request.json()).collectionId}" not found.`);
				}
				throw error(404, `Flashcard or related record not found.`);
			}
		}
		throw error(500, `Failed to update flashcard ${params.id}`);
	}
};

// DELETE /api/flashcards/:id
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const flashcardId = params.id;
		if (!flashcardId) throw error(400, 'Flashcard ID is required');

		await prisma.flashcard.delete({
			where: { id: flashcardId }
		});

		return new Response(null, { status: 204 });
	} catch (e) {
		console.error(`Error deleting flashcard ${params.id}:`, e);
		if (isPrismaError(e)) {
			if (e.status) throw e;
			if (e.code === 'P2025') {
				throw error(404, `Flashcard with ID ${params.id} not found for deletion.`);
			}
		}
		throw error(500, `Failed to delete flashcard ${params.id}`);
	}
};
