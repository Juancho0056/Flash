// src/routes/api/user-flashcard-sm2/all/+server.ts
import { prisma } from '$lib/db';
import { error, json, type RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const { locals } = event;
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	const userId = locals.user.id;

	try {
		const allSm2Records = await prisma.userFlashcardSM2.findMany({
			where: { userId },
			orderBy: {
				dueDate: 'asc'
			}
		});
		return json(allSm2Records);
	} catch (err: unknown) {
		console.error('Failed to get all SM2 records for user:', err);
		throw error(500, 'Could not retrieve all SM2 records.');
	}
}

export async function DELETE(event: RequestEvent) {
	const { locals } = event;
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	const userId = locals.user.id;

	try {
		const result = await prisma.userFlashcardSM2.deleteMany({
			where: { userId }
		});
		console.log(`Deleted ${result.count} SM2 records for user ${userId}`);
		return new Response(null, { status: 204 });
	} catch (err: unknown) {
		console.error('Failed to delete all SM2 records for user:', err);
		throw error(500, 'Could not delete all SM2 records.');
	}
}
