<!-- src/routes/export/printable.svelte -->
<script lang="ts">
  import type { Flashcard } from '@prisma/client';

  export let data: {
    cards: Flashcard[];
    layout: { cols: number; rows: number; totalPerPage: number };
    margins: { top: string; bottom: string; left: string; right: string };
    gutter: string;
    pages: Flashcard[][];
  };

  function escapeHtml(unsafe: string | null | undefined): string {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

</script>

<svelte:head>
  <title>Printable Flashcards</title>
  {#if data && data.margins && data.layout}
  <style>
    @page {
      size: A4;
      margin: {data.margins.top} {data.margins.right} {data.margins.bottom} {data.margins.left};
    }
    body {
      margin: 0;
      padding: 0;
      font-family: sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page-container {
      display: block;
      page-break-after: always;
      height: calc(29.7cm - {data.margins.top} - {data.margins.bottom});
      width: calc(21cm - {data.margins.left} - {data.margins.right});
      box-sizing: border-box;
    }
    .page-container:last-child {
      page-break-after: auto;
    }
    .grid-container {
      display: grid;
      grid-template-columns: repeat({data.layout.cols}, 1fr);
      grid-template-rows: repeat({data.layout.rows}, 1fr);
      gap: {data.gutter};
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .card-print {
      border: 0.5pt solid #444;
      border-radius: 4px;
      padding: 0.3cm;
      box-sizing: border-box;
      overflow: hidden;
      page-break-inside: avoid !important;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      width: 100%;
      height: 100%;
    }
    .card-print .question {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 0.2cm;
    }
    .card-print .answer {
      font-size: 10pt;
      margin-top: 0.2cm;
      color: #222;
    }
    .card-print .image {
      display: block;
      margin: 0.2cm auto;
      max-height: 3cm;
      max-width: 90%;
      object-fit: contain;
    }

    {#if data.layout.totalPerPage === 9}
    .card-print .question { font-size: 10pt; margin-bottom: 0.15cm; }
    .card-print .answer { font-size: 8pt; margin-top: 0.15cm; }
    .card-print .image { max-height: 2.5cm; }
    {:else if data.layout.totalPerPage === 4}
    .card-print .question { font-size: 14pt; }
    .card-print .answer { font-size: 11pt; }
    .card-print .image { max-height: 3.5cm; }
    {/if}
  </style>
  {/if}
</svelte:head>

{#if data && data.pages && data.pages.length > 0}
  {#each data.pages as pageCards, pageIndex (pageIndex)}
    <div class="page-container">
      <div class="grid-container">
        {#each pageCards as card (card.id)}
          <div class="card-print">
            {#if card.imageUrl}
              <img src={escapeHtml(card.imageUrl)} alt="Flashcard Image" class="image"/>
            {/if}
            <div class="question">{@html escapeHtml(card.question)}</div>
            <div class="answer">{@html escapeHtml(card.answer)}</div>
          </div>
        {/each}
        {#if pageCards.length < data.layout.totalPerPage && pageCards.length > 0 }
          <!-- Add placeholders only if there were cards on this page but it's not full -->
          {#each Array(data.layout.totalPerPage - pageCards.length) as _, i}
            <div class="card-print empty-card-slot" style="border: 0.5pt dashed #ccc;"></div>
          {/each}
        {:else if pageCards.length === 0}
           <!-- Fill all slots if the page is intentionally blank (e.g. pages.push([]) was used) -->
           {#each Array(data.layout.totalPerPage) as _, i}
            <div class="card-print empty-card-slot" style="border: 0.5pt dashed #ccc;"></div>
          {/each}
        {/if}
      </div>
    </div>
  {/each}
{:else}
  <div class="page-container"> <!-- Ensure there's at least one page structure for Puppeteer -->
      <div class="grid-container" style="{data && data.layout ? `grid-template-columns: repeat(${data.layout.cols}, 1fr); grid-template-rows: repeat(${data.layout.rows}, 1fr); gap: ${data.gutter};` : 'display: block;'}">
          {#if data && data.layout}
            {#each Array(data.layout.totalPerPage) as _, i}
                <div class="card-print empty-card-slot" style="border: 0.5pt dashed #ccc; display: flex; align-items: center; justify-content: center; text-align:center;">
                  {#if i === 0} <p>No cards found or an error occurred.</p> {/if}
                </div>
            {/each}
          {:else}
            <p style="text-align: center; margin-top: 2cm; font-size: 16pt;">
                No flashcards to display or data is missing.
            </p>
          {/if}
      </div>
  </div>
  {#if !data}
    <p style="text-align: center; color: red; position: absolute; top: 10px; width:100%;">Data object not provided to printable view.</p>
  {/if}
{/if}
