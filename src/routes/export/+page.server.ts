// src/routes/export/+page.server.ts
import { error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import type { PageServerLoad } from './$types';
import type { Flashcard } from '@prisma/client';

export const load: PageServerLoad = async ({ url }) => {
  const idsParam = url.searchParams.get('ids');
  const layoutParam = url.searchParams.get('layout');
  const marginsParam = url.searchParams.get('margins');
  const gutterParam = url.searchParams.get('gutter');

  if (!idsParam && !url.searchParams.has('showEmpty')) { // Allow ?showEmpty for debugging an empty layout
    throw error(400, 'Flashcard IDs are required (query parameter "ids"). Example: ?ids=id1,id2,id3');
  }

  const finalIds = idsParam ? idsParam.split(',') : [];

  const layoutNumStr = layoutParam || '6'; // Default to 6 if not provided
  if (!['4', '6', '9'].includes(layoutNumStr)) {
    throw error(400, 'A valid layout (4, 6, or 9) is required (query parameter "layout"). Example: ?layout=6');
  }
  const layoutNum = parseInt(layoutNumStr, 10) as 4 | 6 | 9;

  const margins = { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" };
  if (marginsParam) {
    const parts = marginsParam.split(',');
    if (parts.length === 4) {
      margins.top = parts[0]; margins.right = parts[1]; margins.bottom = parts[2]; margins.left = parts[3];
    } else if (parts.length === 1) {
        margins.top = margins.right = margins.bottom = margins.left = parts[0];
    }
  }
  const gutter = gutterParam || "0.5cm";

  let cols: number, rows: number;
  switch (layoutNum) {
    case 4: cols = 2; rows = 2; break;
    case 6: cols = 3; rows = 2; break;
    case 9: cols = 3; rows = 3; break;
    default: cols = 3; rows = 2;
  }
  const totalPerPage = cols * rows;

  try {
    let sortedCards: Flashcard[] = [];
    if (finalIds.length > 0) {
        const fetchedCards = await prisma.flashcard.findMany({
          where: { id: { in: finalIds } },
        });
        const cardsById = new Map(fetchedCards.map(card => [card.id, card]));
        sortedCards = finalIds.map(id => cardsById.get(id)).filter(Boolean) as Flashcard[];
    }

    const pages: Flashcard[][] = [];
    if (sortedCards.length > 0) {
        for (let i = 0; i < sortedCards.length; i += totalPerPage) {
          pages.push(sortedCards.slice(i, i + totalPerPage));
        }
    } else {
      // If no cards (either no IDs provided, or none found), create one empty page for layout debugging.
      // This helps Puppeteer render at least one page with the grid structure.
      pages.push([]);
    }

    return {
      cards: sortedCards,
      layout: { cols, rows, totalPerPage },
      margins,
      gutter,
      pages,
    };
  } catch (e: unknown) {
    console.error('Error fetching flashcards for printable view:', e);

     let message = 'Failed to fetch flashcards for printing.';
    if (e instanceof TypeError ) {
      message = e.message;
    } else if (e instanceof Error) {
      message = e.message;
    }
    // Return a structure that still allows the page to render an error message within the layout
    return {
        cards: [],
        layout: { cols, rows, totalPerPage },
        margins,
        gutter,
        pages: [[]], // One empty page
        loadError: message || 'Failed to fetch flashcards for printing.'
    };
  }
};
