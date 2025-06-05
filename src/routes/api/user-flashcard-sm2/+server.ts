// src/routes/api/user-flashcard-sm2/+server.ts
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';
// We don't need to import UserFlashcardSM2 type for Prisma operations if we use Prisma's generated types implicitly,
// but it can be useful for casting or explicit return types. For now, we'll rely on Prisma's inference.

// --- SM-2 Calculation Logic (re-homed from client-side sm2Service) ---
const DEFAULT_EF = 2.5;

interface SM2CalculationParams {
    easinessFactor: number;
    repetitions: number;
    intervalDays: number;
}

function calculateSM2Core(
    current: SM2CalculationParams | null,
    quality: number
): SM2CalculationParams {
    let { easinessFactor, repetitions, intervalDays } = current || {
        easinessFactor: DEFAULT_EF,
        repetitions: 0,
        intervalDays: 0, // Will be set based on quality for the first review
    };

    if (quality < 0 || quality > 5) {
        // This should ideally be validated before calling, but as a safeguard:
        console.warn(`Quality ${quality} out of bounds, clamping to 0-5.`);
        quality = Math.max(0, Math.min(5, quality));
    }

    // Update Easiness Factor
    easinessFactor = Math.max(1.3, easinessFactor - 0.8 + 0.28 * quality - 0.02 * quality * quality);

    // Update repetitions and interval
    if (quality < 3) { // Incorrect response or difficult correct response
        repetitions = 0; // Reset repetitions count
        intervalDays = 1;    // Next review in 1 day
    } else { // Correct response (quality >= 3)
        repetitions += 1;
        if (repetitions === 1) {
            intervalDays = 1;
        } else if (repetitions === 2) {
            intervalDays = 6;
        } else {
            // Interval grows based on the new EF and previous interval.
            // Ensure intervalDays is at least 1 if it was 0 from initialization.
            intervalDays = Math.ceil((intervalDays || 1) * easinessFactor);
        }
    }
    return { easinessFactor, repetitions, intervalDays };
}
// --- End of SM-2 Calculation Logic ---


interface UpdateSM2ApiPayload { // Matches client's UpdateSM2Payload
    flashcardId: string;
    collectionId: string; // This is the originalCollectionId for the SM-2 record context
    collectionName?: string;
    quality: number; // 0-5
}

export async function POST(event: RequestEvent) {
    const { locals } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;

    let payload: UpdateSM2ApiPayload;
    try {
        payload = await event.request.json();
    } catch (e) {
        throw error(400, 'Invalid request body: Could not parse JSON.');
    }

    if (!payload.flashcardId || !payload.collectionId || payload.quality === undefined) {
        throw error(400, 'Missing required fields (flashcardId, collectionId, quality).');
    }
    if (typeof payload.quality !== 'number' || payload.quality < 0 || payload.quality > 5) {
        throw error(400, 'Invalid quality score. Must be a number between 0 and 5.');
    }

    try {
        const existingSM2 = await prisma.userFlashcardSM2.findUnique({
            where: {
                userId_flashcardId: { userId, flashcardId: payload.flashcardId }
            }
        });

        const sm2InputParams: SM2CalculationParams | null = existingSM2 ? {
            easinessFactor: existingSM2.easinessFactor,
            repetitions: existingSM2.repetitions,
            intervalDays: existingSM2.intervalDays,
        } : null;

        const newSm2Values = calculateSM2Core(sm2InputParams, payload.quality);

        const now = new Date();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const dueDate = new Date(now.getTime() + newSm2Values.intervalDays * oneDayInMs);

        const dataForDb = {
            userId,
            flashcardId: payload.flashcardId,
            easinessFactor: newSm2Values.easinessFactor,
            repetitions: newSm2Values.repetitions,
            intervalDays: newSm2Values.intervalDays,
            dueDate: dueDate,
            lastReviewed: now,
            originalCollectionId: payload.collectionId, // Use collectionId from payload
            collectionName: payload.collectionName,     // Use collectionName from payload
        };

        const upsertedRecord = await prisma.userFlashcardSM2.upsert({
            where: {
                userId_flashcardId: { userId, flashcardId: payload.flashcardId }
            },
            create: dataForDb,
            update: { // Specify all fields that should be updated
                easinessFactor: newSm2Values.easinessFactor,
                repetitions: newSm2Values.repetitions,
                intervalDays: newSm2Values.intervalDays,
                dueDate: dueDate,
                lastReviewed: now,
                originalCollectionId: payload.collectionId, // Keep these consistent or update if necessary
                collectionName: payload.collectionName,
                // updatedAt is handled automatically by Prisma @updatedAt
            }
        });
        return json(upsertedRecord, { status: 200 });

    } catch (e: any) {
        console.error(`Failed to update SM2 data for card ${payload.flashcardId}:`, e);
        if (e.code === 'P2003' && e.meta?.field_name?.includes('flashcardId')) {
             throw error(400, `Flashcard with ID ${payload.flashcardId} not found or invalid.`);
        }
         if (e.code === 'P2003') { // Broader foreign key constraint
             throw error(400, `Data integrity issue: ${e.meta?.field_name || 'related record not found'}.`);
        }
        throw error(500, 'Could not update SM2 data.');
    }
}

export async function GET(event: RequestEvent) {
    const { locals, url } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;
    const flashcardId = url.searchParams.get('flashcardId');

    if (!flashcardId) {
        // If flashcardId is optional, this might fetch all for a user.
        // For now, assume it's required for fetching a specific SM2 record.
        throw error(400, 'Missing flashcardId query parameter.');
    }

    try {
        const sm2Record = await prisma.userFlashcardSM2.findUnique({
            where: {
                userId_flashcardId: { userId, flashcardId }
            }
        });
        if (!sm2Record) {
            // Return 404 as JSON as per client service expectation
            return json({ message: 'SM2 record not found for this user and flashcard.' }, { status: 404 });
        }
        return json(sm2Record);
    } catch (e: any) {
        console.error(`Failed to get SM2 data for card ${flashcardId}:`, e);
        throw error(500, 'Could not retrieve SM2 data.');
    }
}

export async function DELETE(event: RequestEvent) {
    const { locals, url } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;
    const flashcardId = url.searchParams.get('flashcardId');

    if (!flashcardId) { // Strict check for flashcardId
        throw error(400, 'Missing flashcardId query parameter.');
    }

    // Delete specific card's SM2 data for the user
    try {
        await prisma.userFlashcardSM2.delete({
            where: {
                userId_flashcardId: { userId, flashcardId }
            }
        });
        return new Response(null, { status: 204 }); // No Content
    } catch (e: any) {
        if (e.code === 'P2025') { // Prisma error code for "Record to delete not found"
            throw error(404, 'SM2 record not found to delete for this user and flashcard.');
        }
        console.error(`Failed to delete SM2 data for card ${flashcardId} for user ${userId}:`, e);
        throw error(500, 'Could not delete SM2 data.');
    }
}
