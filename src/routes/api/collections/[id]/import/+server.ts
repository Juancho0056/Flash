// src/routes/api/collections/[id]/import/+server.ts
import { error, json, type RequestHandler } from '@sveltejs/kit';
import * as XLSX from 'xlsx';
import { prisma } from '$lib/db';

export const POST: RequestHandler = async ({ params, request }) => {
	console.log('Importing flashcards from Excel file');
	const collectionId = params.id;
	if (!collectionId) throw error(400, 'Missing collection ID');

	const formData = await request.formData();
	const uploadedFile = formData.get('file') as File;

	if (!uploadedFile) throw error(400, 'No file uploaded');

	const arrayBuffer = await uploadedFile.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer); // Usamos Buffer para compatibilidad con XLSX

	const workbook = XLSX.read(buffer, { type: 'buffer' });
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const rows = XLSX.utils.sheet_to_json(sheet) as {
		question: string;
		answer: string;
		pronunciation?: string;
		example?: string;
		imageUrl?: string;
	}[];

	const dataToInsert = rows
		.filter((row) => row.question && row.answer)
		.map((row) => ({
			question: row.question,
			answer: row.answer,
			pronunciation: row.pronunciation ?? null,
			example: row.example ?? null,
			imageUrl: row.imageUrl ?? null,
			collectionId,
		}));

	if (dataToInsert.length === 0) throw error(400, 'No valid flashcards in file');

	const created = await prisma.flashcard.createMany({
		data: dataToInsert,
		skipDuplicates: true
	});

	return json({ message: 'Import successful', count: created.count });
};
