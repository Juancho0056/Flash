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

  let cols: number, rows: number;
  switch (layout) {
    case 4: cols = 2; rows = 2; break;
    case 6: cols = 3; rows = 2; break;
    case 9: cols = 3; rows = 3; break;
    default: // Default to 6 cards per page
      cols = 3; rows = 2;
      console.warn(`Invalid layout: ${layout}. Defaulting to 6 cards per page (3x2).`);
  }
  const totalPerPage = cols * rows;

  const pagesHtml: string[] = [];
  for (let i = 0; i < cards.length; i += totalPerPage) {
    const slice = cards.slice(i, i + totalPerPage);

    const cardsHtml = slice
      .map(card => `
        <div class="card-print">
          ${card.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" class="image" alt="Imagen"/>` : ""}
          <div class="question">${escapeHtml(card.question)}</div>
          <div class="answer">${escapeHtml(card.answer)}</div>
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
              font-family: sans-serif;
              -webkit-print-color-adjust: exact; /* Ensure background colors/images are printed in WebKit */
              print-color-adjust: exact; /* Standard property */
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(${cols}, 1fr);
              grid-template-rows: repeat(${rows}, 1fr); /* Adjusted for dynamic rows */
              gap: ${gutter};
              height: calc(29.7cm - ${margins.top} - ${margins.bottom}); /* A4 height minus vertical margins */
              width: calc(21cm - ${margins.left} - ${margins.right}); /* A4 width minus horizontal margins */
              box-sizing: border-box;
            }
            .card-print {
              border: 0.5pt solid #444;
              border-radius: 4px;
              padding: 0.3cm;
              box-sizing: border-box;
              overflow: hidden;
              page-break-inside: avoid;
              display: flex; /* For centering content if needed */
              flex-direction: column;
              justify-content: center; /* Vertically center content in card */
              align-items: center; /* Horizontally center content */
              width: 100%; /* Fill grid cell */
              height: 100%; /* Fill grid cell */
            }
            .question {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 0.2cm;
              text-align: center;
            }
            .answer {
              font-size: 10pt;
              text-align: center;
              margin-top: 0.2cm;
              color: #222;
            }
            .image {
              display: block;
              margin: 0 auto 0.2cm auto;
              max-height: 3cm; /* As per spec */
              max-width: 100%; /* Ensure image is not wider than card */
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `;
    pagesHtml.push(html);
  }

  // Helper function to escape HTML special characters
  function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') {
        return ''; // Or handle as an error, or convert to string
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // Often needed in Docker
      "--font-render-hinting=none" // Try to improve font rendering
    ],
    headless: true // Or 'new' for newer versions
  });
  const page = await browser.newPage();
  const pdfBuffers: Buffer[] = [];

  for (const html of pagesHtml) {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { // Control margins via CSS @page, but can be set here too
        top: margins.top,
        bottom: margins.bottom,
        left: margins.left,
        right: margins.right
      }
    });
    pdfBuffers.push(pdf);
  }

  await browser.close();

  if (pdfBuffers.length === 0) {
    return Buffer.alloc(0);
  }

  return Buffer.concat(pdfBuffers);
}
