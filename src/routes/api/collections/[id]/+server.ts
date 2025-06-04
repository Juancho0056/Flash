// src/routes/api/collections/[id].ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';

// GET /api/collections/:id - Get a single collection by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const collectionId = params.id;
    if (!collectionId) {
      throw error(400, 'Collection ID is required');
    }

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        flashcards: true, // Include all flashcards in this collection
        _count: { select: { flashcards: true } }
      },
    });

    if (!collection) {
      throw error(404, 'Collection not found');
    }
    return json(collection);
  } catch (e: any) {
    console.error(`Error fetching collection ${params.id}:`, e);
    if (e.status) throw e;
    throw error(500, `Failed to fetch collection ${params.id}`);
  }
};

// PUT /api/collections/:id - Update a collection
export const PUT: RequestHandler = async ({ request, params }) => {
  try {
    const collectionId = params.id;
    if (!collectionId) {
      throw error(400, 'Collection ID is required');
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      throw error(400, 'Collection name is required for update');
    }

    // Rely on Prisma's P2002 for unique constraint violation on 'name'
    // const existingCollectionWithSameName = await prisma.collection.findFirst({
    //     where: {
    //         name: name,
    //         id: { not: collectionId }
    //     }
    // });
    // if (existingCollectionWithSameName) {
    //     throw error(409, `Another collection with the name "${name}" already exists.`);
    // }

    const updatedCollection = await prisma.collection.update({
      where: { id: collectionId },
      data: { name },
    });
    return json(updatedCollection);
  } catch (e: any) {
    console.error(`Error updating collection ${params.id}:`, e);
    if (e.status) throw e;
    if (e.code === 'P2002' && e.meta?.target?.includes('name')) {
        throw error(409, `Collection name "${body.name}" is already taken by another collection.`);
    }
    if (e.code === 'P2025') {
      throw error(404, `Collection with ID ${params.id} not found for update.`);
    }
    throw error(500, `Failed to update collection ${params.id}`);
  }
};

// DELETE /api/collections/:id - Delete a collection
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const collectionId = params.id;
    if (!collectionId) {
      throw error(400, 'Collection ID is required');
    }

    // Current schema: Flashcard.collectionId is optional.
    // Deleting a collection will set Flashcard.collectionId to null for associated cards.
    // If cascade delete is desired, it should be configured in prisma.schema and possibly handled in a transaction.
    // Example for explicit cascade (if not in schema):
    // await prisma.$transaction([
    //   prisma.flashcard.updateMany({ where: { collectionId: collectionId }, data: { collectionId: null } }), // or deleteMany
    //   prisma.collection.delete({ where: { id: collectionId } })
    // ]);

    await prisma.collection.delete({
      where: { id: collectionId },
    });
    return json({ message: 'Collection deleted successfully' }, { status: 200 });
  } catch (e: any) {
    console.error(`Error deleting collection ${params.id}:`, e);
    if (e.status) throw e;
    if (e.code === 'P2025') {
      throw error(404, `Collection with ID ${params.id} not found for deletion.`);
    }
    throw error(500, `Failed to delete collection ${params.id}`);
  }
};
