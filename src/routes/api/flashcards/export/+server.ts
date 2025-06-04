// src/routes/api/flashcards/export.ts
import type { RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { generarPdfDeFlashcards } from '$lib/pdf'; // Ensure this path is correct
import { error } from '@sveltejs/kit';
import type { Flashcard } from '@prisma/client'; // Assuming Flashcard type

interface ExportRequestBody {
  ids: string[];
  layout: 4 | 6 | 9;
  margins?: { top: string, bottom: string, left: string, right: string };
  gutter?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as ExportRequestBody;
    const { ids, layout, margins, gutter } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw error(400, 'Flashcard IDs array is required and cannot be empty.');
    }
    if (!layout || ![4, 6, 9].includes(layout)) {
      throw error(400, 'Valid layout (4, 6, or 9) is required.');
    }

    const flashcards = await prisma.flashcard.findMany({
      where: {
        id: { in: ids },
      },
      // Consider preserving the order of IDs if it matters for the PDF output.
      // Prisma's `findMany` with `id: { in: [...] }` does not guarantee order.
      // If order matters, fetch one by one or re-sort after fetching:
      // const fetchedFlashcards = await prisma.flashcard.findMany({ where: { id: { in: ids } } });
      // const flashcardsMap = new Map(fetchedFlashcards.map(fc => [fc.id, fc]));
      // const sortedFlashcards = ids.map(id => flashcardsMap.get(id)).filter(fc => fc !== undefined) as Flashcard[];

    });

    if (flashcards.length === 0) {
        throw error(404, 'None of the provided flashcard IDs resulted in found flashcards.');
    }
    // Warning if some cards were not found but not all
    if (flashcards.length < ids.length) {
      console.warn(`PDF Export: Not all requested card IDs were found. Found ${flashcards.length} out of ${ids.length}.`);
    }

    const pdfBuffer = await generarPdfDeFlashcards(flashcards as Flashcard[], { layout, margins, gutter });

    if (!pdfBuffer || pdfBuffer.length === 0) {
        throw error(500, 'Failed to generate PDF: No content generated or PDF is empty.');
    }

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="flashcards-export-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  }catch (e: unknown) {
    console.error('Error exporting flashcards to PDF:', e);

    if (e && typeof e === 'object' && 'status' in e) {
      throw e as { status: number }; // Si estás seguro que `e` tiene `status`
    }

    throw error(500, 'Failed to export flashcards to PDF.');
  }
};
