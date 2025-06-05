// src/lib/services/exportService.ts

import { getDueCards, type SuggestedCard } from './studySuggestionService';
import type { Flashcard as PrismaFlashcard } from '@prisma/client'; // Assuming Prisma types are available

// Helper function to fetch full flashcard details
// This assumes an API endpoint GET /api/flashcards/[id] exists
async function getFlashcardDetails(flashcardId: string): Promise<PrismaFlashcard | null> {
    try {
        const response = await fetch(`/api/flashcards/${flashcardId}`);
        if (!response.ok) {
            console.error(`Failed to fetch details for flashcard ${flashcardId}: ${response.status}`);
            return null;
        }
        return await response.json() as PrismaFlashcard;
    } catch (error) {
        console.error(`Error fetching details for flashcard ${flashcardId}:`, error);
        return null;
    }
}

// Function to convert data to CSV and trigger download
function downloadCsv(data: any[], fileName: string = 'export.csv'): void {
    if (!data || data.length === 0) {
        alert('No data to export.');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','), // Header row
        ...data.map(row =>
            headers.map(header => {
                let cellData = row[header] === null || row[header] === undefined ? '' : String(row[header]);
                // Escape double quotes by doubling them, and wrap if cell contains comma, newline or double quote
                if (/[",
]/.test(cellData)) {
                    cellData = `"${cellData.replace(/"/g, '""')}"`;
                }
                return cellData;
            }).join(',')
        )
    ];
    const csvString = csvRows.join('\r\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert('CSV download is not supported by your browser.');
    }
}

export async function exportDueCardsToCsv(userId?: string): Promise<void> {
    const dueCardsSuggestions = getDueCards(userId, 1000); // Get many due cards, no specific limit for export

    if (dueCardsSuggestions.length === 0) {
        alert('No cards are currently due for review.');
        return;
    }

    const exportData = [];
    console.log(`Fetching details for ${dueCardsSuggestions.length} due cards...`);

    for (const suggestedCard of dueCardsSuggestions) {
        const details = await getFlashcardDetails(suggestedCard.flashcardId);
        if (details) {
            exportData.push({
                Question: details.question,
                Answer: details.answer,
                Pronunciation: details.pronunciation || '',
                Example: details.example || '',
                CollectionName: suggestedCard.sm2Parameters.collectionName || 'N/A',
                DueDate: new Date(suggestedCard.dueDate).toLocaleDateString(),
                EasinessFactor: suggestedCard.sm2Parameters.easinessFactor.toFixed(2),
                IntervalDays: suggestedCard.sm2Parameters.interval,
                Repetitions: suggestedCard.sm2Parameters.repetitions,
                IsDifficult: details.isDifficult // Add this if available and desired
            });
        }
    }

    if (exportData.length > 0) {
        downloadCsv(exportData, 'due_flashcards_export.csv');
    } else {
        alert('Could not fetch details for any due cards, or no due cards found.');
    }
}
