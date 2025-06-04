// src/routes/api/collections/index.ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { json, error } from '@sveltejs/kit';

// GET /api/collections - Get all collections
export const GET: RequestHandler = async () => {
  try {
    const collections = await prisma.collection.findMany({
      include: { _count: { select: { flashcards: true } } }, // Include count of flashcards
    });
    return json(collections);
  } catch (e) {
    console.error('Error fetching collections:', e);
    throw error(500, 'Failed to fetch collections');
  }
};

// POST /api/collections - Create a new collection
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      throw error(400, 'Collection name is required');
    }

    // It's better to rely on Prisma's unique constraint error (P2002)
    // than to do a separate findUnique check, to avoid race conditions.
    // However, the explicit check is kept here as per the generated code's initial thought.
    // const existingCollection = await prisma.collection.findUnique({
    //     where: { name },
    // });
    // if (existingCollection) {
    //     throw error(409, `Collection with name "${name}" already exists.`);
    // }

    const newCollection = await prisma.collection.create({
      data: {
        name,
      },
    });
    return json(newCollection, { status: 201 });
  } catch (e: any) {
    console.error('Error creating collection:', e);
    if (e.status) throw e; // Forward SvelteKit errors
    // Handle Prisma unique constraint violation for the 'name' field
    if (e.code === 'P2002' && e.meta?.target?.includes('name')) {
        throw error(409, `Collection with name "${body.name}" already exists.`);
    }
    throw error(500, 'Failed to create collection');
  }
};
