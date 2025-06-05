import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';
import type { Prisma } from '@prisma/client';

// Define el tipo de cuerpo esperado para PUT
interface UpdateCollectionBody {
  name?: string; // Make name optional
  cefrLevel?: string | null; // Allow string for level, or null to clear it
}

// GET /api/collections/:id
export const GET: RequestHandler = async ({ params }) => {
  const collectionId = params.id;
  if (!collectionId) {
    throw error(400, 'Collection ID is required');
  }

  try {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        flashcards: true,
        _count: { select: { flashcards: true } }
      }
    });

    if (!collection) {
      throw error(404, 'Collection not found');
    }

    return json(collection);
  } catch (e) {
    console.error(`Error fetching collection ${collectionId}:`, e);
    throw error(500, `Failed to fetch collection ${collectionId}`);
  }
};

// PUT /api/collections/:id
export const PUT: RequestHandler = async ({ request, params }) => {
  const collectionId = params.id;
  if (!collectionId) {
    throw error(400, 'Collection ID is required');
  }

  let body: UpdateCollectionBody;

  try {
    body = await request.json() as UpdateCollectionBody;
  } catch {
    throw error(400, 'Invalid JSON payload');
  }

  const { name, cefrLevel } = body;

  if (name === undefined && cefrLevel === undefined) {
    throw error(400, 'At least one field (name or cefrLevel) must be provided for update.');
  }

  const updateData: Prisma.CollectionUpdateInput = {};

  if (name !== undefined) {
    if (typeof name === 'string' && name.trim() === '') {
        throw error(400, 'Collection name cannot be empty if provided.');
    }
    updateData.name = name.trim();
  }

  if (cefrLevel !== undefined) {
    if (cefrLevel === null || cefrLevel === '') {
      updateData.cefrLevel = null; // Clear the CEFR level
    } else {
      // Prisma client expects string matching enum member for enum types
      updateData.cefrLevel = cefrLevel;
    }
  }

  try {
    const updatedCollection = await prisma.collection.update({
      where: { id: collectionId },
      data: updateData,
    });
    return json(updatedCollection);
  } catch (e) {
    const err = e as Prisma.PrismaClientKnownRequestError;

    if (
      err.code === 'P2002' &&
      Array.isArray(err.meta?.target) &&
      err.meta?.target.includes('name')
    ) {
      throw error(409, `Collection name "${name}" is already taken.`);
    }

    if (err.code === 'P2025') {
      throw error(404, `Collection with ID ${collectionId} not found.`);
    }

    console.error(`Error updating collection ${collectionId}:`, err);
    throw error(500, `Failed to update collection ${collectionId}`);
  }
};

// DELETE /api/collections/:id
export const DELETE: RequestHandler = async ({ params }) => {
  const collectionId = params.id;
  if (!collectionId) {
    throw error(400, 'Collection ID is required');
  }

  try {
    await prisma.collection.delete({
      where: { id: collectionId }
    });

    return json({ message: 'Collection deleted successfully' });
  } catch (e) {
    const err = e as Prisma.PrismaClientKnownRequestError;

    if (err.code === 'P2025') {
      throw error(404, `Collection with ID ${collectionId} not found.`);
    }

    console.error(`Error deleting collection ${collectionId}:`, err);
    throw error(500, `Failed to delete collection ${collectionId}`);
  }
};
