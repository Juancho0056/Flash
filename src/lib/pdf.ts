// src/lib/pdf.ts
import puppeteer from "puppeteer";
import type { Flashcard } from "@prisma/client"; // Assuming Flashcard type will be available via Prisma

interface PdfOptions {
  layout: 4 | 6 | 9;
  margins?: { top: string, bottom: string, left: string, right: string };
  gutter?: string;
}

export async function generarPdfDeFlashcards(cards: Flashcard[], options: PdfOptions): Promise<Buffer> {
	const { layout, margins = { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" }, gutter = "0.5cm" } = options;

	let cols: number
	switch (layout) {
		case 4: cols = 2;  break;
		case 6: cols = 3;  break;
		case 9: cols = 3;  break;
		default: cols = 3;
	}


	// Render todas las tarjetas en un solo HTML
	const allCardsHtml = cards.map(card => `
		<div class="card-print">
			<div class="question">${escapeHtml(card.question)}</div>
			${card.pronunciation ? `<div class="pronunciation">[${escapeHtml(card.pronunciation)}]</div>` : ""}
			<div class="answer">${escapeHtml(card.answer)}</div>
			${card.example ? `<div class="example">${escapeHtml(card.example)}</div>` : ""}
		</div>
	`).join("");

	const html = `
	<html>
		<head>
			<meta charset="UTF-8">
			<style>
				@page {
					size: A4;
					margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
				}
				body {
					margin: 0;
					padding: 0;
					font-family: 'Segoe UI', sans-serif;
					color: #2c3e50;
					-webkit-print-color-adjust: exact;
					print-color-adjust: exact;
				}
				.grid-container {
					display: grid;
					grid-template-columns: repeat(${cols}, 1fr);
					gap: ${gutter};
					box-sizing: border-box;
				}
				.card-print {
					border: 1px dashed #4a90e2;
					border-radius: 12px;
					padding: 1cm;
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;
					text-align: center;
					page-break-inside: avoid;
					height: 9cm;
				}
				.question {
					font-size: 14pt;
					font-weight: 600;
					margin-bottom: 0.2cm;
				}
				.pronunciation {
					font-size: 11pt;
					color: #7f8c8d;
					font-style: italic;
					margin-bottom: 0.3cm;
				}
				.answer {
					font-size: 12pt;
					color: #34495e;
					margin-top: 0.3cm;
				}
				.example {
					font-size: 11pt;
					margin-top: 0.2cm;
					color: #2980b9;
					font-style: italic;
				}
			</style>
		</head>
		<body>
			<div class="grid-container">
				${allCardsHtml}
			</div>
		</body>
	</html>
	`;

	const browser = await puppeteer.launch({
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
		headless: true
	});
	const page = await browser.newPage();
	await page.setContent(html, { waitUntil: 'networkidle0' });
	const pdfBuffer = await page.pdf({
		format: "A4",
		printBackground: true,
		margin: {
			top: margins.top,
			bottom: margins.bottom,
			left: margins.left,
			right: margins.right
		}
	});
	await browser.close();

	return Buffer.from(pdfBuffer); // Este es un Uint8Array, Buffer lo envuelve bien
}
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
