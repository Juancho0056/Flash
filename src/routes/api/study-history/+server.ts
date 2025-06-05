// src/routes/api/study-history/+server.ts
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';
// Assuming SessionType and SessionStatus from @prisma/client might be needed for explicit casting
// import type { SessionType, SessionStatus } from '@prisma/client';

// Interface for the expected payload from the client for POST requests
interface StudySessionApiPayload {
    originalCollectionId: string;
    collectionName: string;
    sessionStartTime: number; // JS timestamp (ms)
    sessionEndTime: number;   // JS timestamp (ms)
    durationMs: number;
    cardsInView: number;
    originalCollectionSize?: number;
    cardsAttempted?: number;
    correct: number;
    incorrect: number;
    score: number;
    streak: number;
    longestStreak: number;
    sessionType: string; // e.g., "FULL", "REVIEW" (maps to SessionType enum)
    status: string;      // e.g., "COMPLETED", "ABANDONED" (maps to SessionStatus enum)
}


export async function POST(event: RequestEvent) {
    const { locals } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;

    let payload: StudySessionApiPayload;
    try {
        payload = await event.request.json();
    } catch (e) {
        throw error(400, 'Invalid request body: Could not parse JSON.');
    }

    // Basic validation
    if (!payload.originalCollectionId || !payload.collectionName || !payload.sessionType || !payload.status ||
        payload.sessionStartTime === undefined || payload.sessionEndTime === undefined || payload.durationMs === undefined ||
        payload.cardsInView === undefined || payload.correct === undefined || payload.incorrect === undefined ||
        payload.score === undefined || payload.streak === undefined || payload.longestStreak === undefined
    ) {
        throw error(400, 'Missing required fields in session data.');
    }

    const sessionStartTimeDate = new Date(payload.sessionStartTime);
    const sessionEndTimeDate = new Date(payload.sessionEndTime);

    // It's good practice to ensure enum string values match Prisma's expectations.
    // Prisma client is generally case-insensitive for assigning string values to enums,
    // but explicit casting or transformation (like .toUpperCase()) ensures consistency.
    const sessionTypeForDb = payload.sessionType.toUpperCase();
    const statusForDb = payload.status.toUpperCase();

    // Validate if these string values are actual members of your Prisma enums
    // This step is pseudo-code unless you have a utility or list of enum values.
    // For example: if (!Object.values(Prisma.SessionType).includes(sessionTypeForDb)) { ... error ... }
    // For now, we proceed assuming the client sends valid string representations.

    try {
        const newRecord = await prisma.studySessionRecord.create({
            data: {
                userId: userId,
                originalCollectionId: payload.originalCollectionId,
                collectionName: payload.collectionName,
                originalCollectionSize: payload.originalCollectionSize ?? 0,
                sessionStartTime: sessionStartTimeDate,
                sessionEndTime: sessionEndTimeDate,
                durationMs: payload.durationMs,
                cardsInView: payload.cardsInView,
                cardsAttempted: payload.cardsAttempted,
                correctAnswers: payload.correct,
                incorrectAnswers: payload.incorrect,
                score: payload.score,
                finalStreak: payload.streak,
                longestStreakInSession: payload.longestStreak,
                // Prisma client will map these strings to the enum types
                // Ensure these strings (e.g., "FULL", "COMPLETED") match your Prisma enum definitions
                sessionType: sessionTypeForDb as any, // Cast to any if not importing Prisma enum types
                status: statusForDb as any,       // Cast to any if not importing Prisma enum types
            },
        });
        return json(newRecord, { status: 201 });
    } catch (e: any) {
        console.error('Failed to create study session record:', e);
        // Check for specific Prisma errors, e.g., foreign key violation, unique constraint
        if (e.code === 'P2002') { // Unique constraint violation
             throw error(409, `Conflict: A similar record might already exist or unique constraint failed.`);
        }
        if (e.code === 'P2003') { // Foreign key constraint failed (e.g. userId does not exist)
             throw error(400, `Bad Request: Invalid data provided (e.g., non-existent related entity) - ${e.meta?.field_name || e.message}`);
        }
         if (e.message?.includes("Enum")) { // Generic check for enum errors if direct mapping fails
            throw error(400, `Bad Request: Invalid value for sessionType or status.`);
        }
        throw error(500, 'Could not save study session.');
    }
}

export async function GET(event: RequestEvent) {
    const { locals, url } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;

    const originalCollectionId = url.searchParams.get('originalCollectionId');
    // const specificUserIdParam = url.searchParams.get('userId'); // For admin use, if needed

    // Regular users can only fetch their own history.
    // If an admin feature to fetch other users' history is needed, add role checks here.
    const whereClause: any = { userId };

    if (originalCollectionId) {
        whereClause.originalCollectionId = originalCollectionId;
    }

    try {
        const records = await prisma.studySessionRecord.findMany({
            where: whereClause,
            orderBy: {
                sessionEndTime: 'desc', // Most recent sessions first
            },
        });
        return json(records);
    } catch (e) {
        console.error('Failed to fetch study session records:', e);
        throw error(500, 'Could not retrieve study sessions.');
    }
}
