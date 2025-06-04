<!-- src/components/Card.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let pronunciation: string | null = null;
  export let front: string = 'Front Content'; // HTML or text for the front
  export let back: string = 'Back Content';   // HTML or text for the back
  export let imageUrl: string | null | undefined = null;
  export let flipped: boolean = false; // Controls the flipped state

  const dispatch = createEventDispatcher();

  function toggleCard() {
    flipped = !flipped;
    dispatch('toggle', { flipped });
  }
  function speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // Cambia a 'es-ES' si la pronunciación es en español
    speechSynthesis.speak(utterance);
  }

</script>

<div class="card-container" on:click={toggleCard} role="button" tabindex="0"
     on:keypress={(e) => e.key === 'Enter' && toggleCard()}
     title={flipped ? 'Click to show question' : 'Click to show answer'}>
  <div class="card-flipper" class:flipped>
    <div class="card-face card-front">
      {#if imageUrl}
        <img src={imageUrl} alt="Flashcard image" class="card-image"/>
      {/if}
      {@html front}
    </div>
    <div class="card-face card-back">
      <div class="text-center">
        {@html back}
        
        {#if pronunciation}
          <p class="mt-2 text-sm text-gray-600 italic">Pronunciation: {pronunciation}</p>
          <button
            type="button"
            on:click|stopPropagation={() => speak(pronunciation)}
            class="mt-2 rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700"
          >
            🔊 Hear it
          </button>
        {/if}
      </div>
  </div>
  </div>
</div>

<style>
  .card-container {
    width: 300px; /* Example width, can be adjusted by parent */
    height: 200px; /* Example height, can be adjusted by parent */
    perspective: 1000px; /* Important for 3D effect */
    cursor: pointer;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  .card-flipper {
    width: 100%;
    height: 100%;
    transition: transform 0.6s;
    transform-style: preserve-3d; /* Children are positioned in 3D space */
    position: relative;
  }

  .card-flipper.flipped {
    transform: rotateY(180deg);
  }

  .card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden; /* Hide the back of the face when turned away */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 20px;
    box-sizing: border-box;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow-wrap: break-word;
    word-wrap: break-word;
    hyphens: auto;
  }

  .card-front {
    background-color: #f0f0f0;
    color: #333;
    /* z-index: 2; Ensure front is initially above back - not strictly needed with backface-visibility */
  }

  .card-back {
    background-color: #e0e0e0;
    color: #333;
    transform: rotateY(180deg); /* Pre-rotate the back face */
  }

  .card-image {
    max-width: 80%;
    max-height: 50%; /* Adjust as needed */
    margin-bottom: 10px;
    object-fit: contain;
  }
</style>
