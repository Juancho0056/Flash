// src/routes/api/user-progress/+server.ts
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';
// UserProgressPayload is the structure sent from the client-side progressService
import type { UserProgressPayload } from '$lib/services/progressService';
// StudyStats might be part of UserProgressPayload, ensure its type is available if needed for validation/transformation
// import type { StudyStats } from '$lib/stores/studyStats';

// The UserProgressPayload from progressService is already well-defined for the client's perspective.
// We'll use it directly as UserProgressApiPayload for type safety on what we expect from the client.
type UserProgressApiPayload = UserProgressPayload;

export async function POST(event: RequestEvent) {
    const { locals } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;

    let payload: UserProgressApiPayload;
    try {
        payload = await event.request.json();
    } catch (e) {
        throw error(400, 'Invalid request body: Could not parse JSON.');
    }

    if (!payload.collectionId) {
        throw error(400, 'Missing collectionId in request payload.');
    }
    if (payload.sessionStartTime === undefined || typeof payload.sessionStartTime !== 'number') {
        throw error(400, 'Invalid or missing sessionStartTime in request payload.');
    }


    const originalCollectionId = payload.collectionId; // Map client's collectionId
    const sessionStartTimeDate = new Date(payload.sessionStartTime);

    const dataToUpsert = {
        userId: userId,
        originalCollectionId: originalCollectionId,
        currentIndex: payload.currentIndex,
        correctAnswers: payload.correctAnswers,
        incorrectAnswers: payload.incorrectAnswers,
        currentScore: payload.currentScore,
        sessionCompleted: payload.sessionCompleted,
        flashcardsState: payload.flashcardsState as any, // Prisma expects JsonValue
        studyStats: payload.studyStats as any,           // Prisma expects JsonValue
        sessionStartTime: sessionStartTimeDate,
        // lastSavedTimestamp will be set by @default(now()) on create or explicitly in update
    };

    try {
        const upsertedProgress = await prisma.userStudyProgress.upsert({
            where: {
                userId_originalCollectionId: { userId, originalCollectionId }
            },
            create: dataToUpsert, // lastSavedTimestamp will use @default(now())
            update: {
                currentIndex: payload.currentIndex,
                correctAnswers: payload.correctAnswers,
                incorrectAnswers: payload.incorrectAnswers,
                currentScore: payload.currentScore,
                sessionCompleted: payload.sessionCompleted,
                flashcardsState: payload.flashcardsState as any,
                studyStats: payload.studyStats as any,
                sessionStartTime: sessionStartTimeDate,
                lastSavedTimestamp: new Date(), // Explicitly update lastSavedTimestamp on update
            },
        });
        return json(upsertedProgress, { status: 200 });
    } catch (e: any) {
        console.error('Failed to save user study progress:', e);
        // Add more specific error handling if needed (e.g., Prisma error codes)
        throw error(500, 'Could not save study progress.');
    }
}

export async function GET(event: RequestEvent) {
    const { locals, url } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;

    const originalCollectionId = url.searchParams.get('originalCollectionId');
    if (!originalCollectionId) {
        throw error(400, 'Missing originalCollectionId query parameter.');
    }

    try {
        const progressRecord = await prisma.userStudyProgress.findUnique({
            where: {
                userId_originalCollectionId: { userId, originalCollectionId }
            },
        });

        if (!progressRecord) {
            // Return 404 directly as per service expectation, not throwing an error that becomes 500
            return json(null, { status: 404 });
        }
        return json(progressRecord);
    } catch (e: any) {
        console.error('Failed to load user study progress:', e);
        throw error(500, 'Could not load study progress.');
    }
}

export async function DELETE(event: RequestEvent) {
    const { locals, url } = event;
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    const userId = locals.user.id;

    const originalCollectionId = url.searchParams.get('originalCollectionId');
    if (!originalCollectionId) {
        throw error(400, 'Missing originalCollectionId query parameter.');
    }

    try {
        await prisma.userStudyProgress.delete({
            where: {
                userId_originalCollectionId: { userId, originalCollectionId }
            },
        });
        return new Response(null, { status: 204 }); // No Content
    } catch (e: any) {
        if (e.code === 'P2025') { // Prisma error code for "Record to delete not found"
            throw error(404, 'Study progress not found to delete.');
        }
        console.error('Failed to delete user study progress:', e);
        throw error(500, 'Could not delete study progress.');
    }
}
