// src/routes/collections/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import { prisma } from '$lib/db'; // Adjust path as necessary
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const collectionId = params.id;

  if (!collectionId) {
    throw error(400, 'Collection ID is required.');
  }

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection) {
    throw error(404, `Collection with ID ${collectionId} not found.`);
  }

  const flashcardsInCollection = await prisma.flashcard.findMany({
    where: { collectionId: collectionId },
    orderBy: { createdAt: 'desc' }, // Or any preferred order
  });

  return {
    collection,
    flashcards: flashcardsInCollection,
  };
};
