<!-- src/components/Card.svelte -->
<script lang="ts">
  import { createEventDispatcher, afterUpdate } from 'svelte'; // Removed onMount
  import { ttsSettings } from '../stores/ttsStore'; // Import the TTS store

  export let pronunciation: string | null = null;
  export let example: string | null | undefined = null;
  export let front: string = 'Front Content'; // HTML or text for the front
  export let back: string = 'Back Content';   // HTML or text for the back
  export let imageUrl: string | null | undefined = null;
  export let flipped: boolean = false; // Controls the flipped state
  export let cardLang: string = 'en-US'; // Default language for TTS

  const dispatch = createEventDispatcher();

  function toggleCard() {
    flipped = !flipped;
    dispatch('toggle', { flipped });
  }

  function speak(text: string, lang: string = 'en-US') {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang || 'en-US'; // Use provided lang or default
      speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech synthesis not supported or not available.');
    }
  }

  // Helper to strip HTML for TTS. This is a very basic stripper.
  // For more robust stripping, a library or more complex regex might be needed.
  function stripHtml(html: string): string {
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || div.innerText || '';
    }
    // Fallback for non-browser environments or if document is not available
    return html.replace(/<[^>]+>/g, '');
  }

  // let currentAutoPlay: boolean; // REMOVED
  let currentDefaultLang: string;
  let currentPlaybackSpeed: number;
  let prevFlipped = flipped; // Ensure this is declared

  ttsSettings.subscribe(settings => {
    // currentAutoPlay = settings.autoPlay; // REMOVED
    currentDefaultLang = settings.defaultLang; // Keep existing
    currentPlaybackSpeed = settings.playbackSpeed; // NEW
  });

  function speak(text: string, lang: string = 'en-US', speed: number = 1) { // Added speed parameter
    console.log('[Card.svelte] speak() called with:', { text, lang, speed });
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // speechSynthesis.cancel(); // Already moved
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang || currentDefaultLang;
      utterance.rate = speed; // Set playback speed
      console.log('[Card.svelte] Attempting to speak:', utterance);
      speechSynthesis.speak(utterance); // THIS IS THE KEY CALL
      return utterance; // Return utterance to attach event listeners if needed
    } else {
      console.warn('[Card.svelte] Speech synthesis not supported or not available.');
      return null;
    }
  }

  // New function to speak all parts of the card with delays
  export async function speakCardDetails(
    { frontText = '', backText = '', exampleText = '', pronunciationText = '', lang = cardLang || currentDefaultLang, speed = currentPlaybackSpeed, delay = 750 }
  ) {
    console.log('[Card.svelte] speakCardDetails() called with:', { frontText, backText, exampleText, pronunciationText, lang, speed, delay });
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[Card.svelte] speakCardDetails: Speech synthesis not supported.');
      return;
    }
    speechSynthesis.cancel();
    console.log('[Card.svelte] speakCardDetails: Initial speech cancelled.');

    // This function is inside speakCardDetails or accessible to it
    const speakAndWait = (textToSpeak: string, currentLang: string, currentSpeed: number) => {
      console.log('[Card.svelte] speakAndWait() called for:', { textToSpeak, currentLang, currentSpeed });
      return new Promise<void>((resolve, reject) => {
        const strippedText = stripHtml(textToSpeak);
        console.log('[Card.svelte] speakAndWait: Stripped text:', strippedText);
        if (!strippedText.trim()) {
          console.log('[Card.svelte] speakAndWait: Text is empty after stripHtml, resolving immediately.');
          resolve();
          return;
        }
        const utterance = speak(strippedText, currentLang, currentSpeed); // 'speak' now logs internally
        if (utterance) {
          utterance.onend = () => {
            console.log('[Card.svelte] speakAndWait: Utterance finished for:', strippedText);
            resolve();
          };
          utterance.onerror = (event) => {
            console.error('[Card.svelte] speakAndWait: Speech synthesis error:', event, 'for text:', strippedText);
            reject(event);
          };
        } else {
          console.log('[Card.svelte] speakAndWait: Speak function returned null, resolving.');
          resolve();
        }
      });
    };

    try {
      if (stripHtml(frontText).trim()) {
        console.log('[Card.svelte] speakCardDetails: Speaking frontText.');
        await speakAndWait(frontText, lang, speed);
        console.log('[Card.svelte] speakCardDetails: Finished frontText, waiting for delay.');
        await new Promise(r => setTimeout(r, delay));
        console.log('[Card.svelte] speakCardDetails: Delay after frontText finished.');
      }
      if (stripHtml(backText).trim()) {
        console.log('[Card.svelte] speakCardDetails: Speaking backText.');
        await speakAndWait(backText, lang, speed);
        console.log('[Card.svelte] speakCardDetails: Finished backText, waiting for delay.');
        await new Promise(r => setTimeout(r, delay));
        console.log('[Card.svelte] speakCardDetails: Delay after backText finished.');
      }
      if (stripHtml(pronunciationText).trim()) { // Speak pronunciation if available
        console.log('[Card.svelte] speakCardDetails: Speaking pronunciationText.');
        await speakAndWait(pronunciationText, lang, speed);
        console.log('[Card.svelte] speakCardDetails: Finished pronunciationText, waiting for delay.');
        await new Promise(r => setTimeout(r, delay));
        console.log('[Card.svelte] speakCardDetails: Delay after pronunciationText finished.');
      }
      if (stripHtml(exampleText).trim()) {
        console.log('[Card.svelte] speakCardDetails: Speaking exampleText.');
        await speakAndWait(exampleText, lang, speed);
        console.log('[Card.svelte] speakCardDetails: Finished exampleText.');
      }
      console.log('[Card.svelte] speakCardDetails: All parts spoken.');
    } catch (error) {
      console.error("[Card.svelte] speakCardDetails: Error during sequential speech playback:", error);
      speechSynthesis.cancel();
      console.log('[Card.svelte] speakCardDetails: Speech cancelled due to error.');
    }
  }

  // Remove auto-speak from onMount for 'front'
  // onMount(() => { // REMOVED onMount block
    // All auto-play logic previously here was commented out and is now fully removed.
  // });

  // Remove auto-speak from afterUpdate for 'back'
  afterUpdate(() => {
    if (flipped !== prevFlipped) {
      // All auto-play logic previously here was commented out and is now fully removed.
      prevFlipped = flipped;
    }
  });

</script>

<div class="card-container" role="button" tabindex="0"
     on:keypress={(e) => e.key === 'Enter' && toggleCard()}
     title={flipped ? 'Click to show question' : 'Click to show answer'}>
  <div class="card-flipper" class:flipped on:click={toggleCard}>
    <div class="card-face card-front">
      {#if imageUrl}
        <img src={imageUrl} alt="Flashcard image" class="card-image"/>
      {/if}
      <div class="content-text">{@html front}</div>
      <button
        type="button"
        class="tts-button"
        on:click|stopPropagation={() => speak(stripHtml(front), cardLang, currentPlaybackSpeed)}
        title="Speak question"
      >
        🔊
      </button>
    </div>
    <div class="card-face card-back">
      <div class="text-center">
        <div class="content-text">{@html back}</div>
        <button
          type="button"
          class="tts-button tts-button-back"
          on:click|stopPropagation={() => speak(stripHtml(back), cardLang, currentPlaybackSpeed)}
          title="Speak answer"
        >
          🔊
        </button>
        {#if example}
          <div class="mt-2 text-sm italic text-gray-600 example-text">
            Example: {example}
            <button
              type="button"
              class="tts-button-inline"
              on:click|stopPropagation={() => speak(stripHtml(example!), cardLang, currentPlaybackSpeed)}
              title="Speak example"
            >
              🔊
            </button>
          </div>
        {/if}
        {#if pronunciation}
          <p class="mt-2 text-sm text-gray-600 italic">Pronunciation: {pronunciation}</p>
          <button
            type="button"
            on:click|stopPropagation={() => speak(stripHtml(pronunciation!), cardLang, currentPlaybackSpeed)}
            class="mt-2 rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 cursor-pointer"
            title="Speak pronunciation"
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
    width: 364px; /* Example width, can be adjusted by parent */
    height: 200px; /* Example height, can be adjusted by parent */
    perspective: 1000px; /* Important for 3D effect */
    /* cursor: pointer; Clicks handled by specific elements or card flipper */
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    position: relative; /* For positioning TTS buttons absolutely if needed */
  }

  .card-flipper {
    width: 100%;
    height: 100%;
    transition: transform 0.6s;
    transform-style: preserve-3d; /* Children are positioned in 3D space */
    position: relative;
    cursor: pointer; /* Retain pointer for flipping */
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
    padding: 15px; /* Adjusted padding */
    box-sizing: border-box;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow-wrap: break-word;
    word-wrap: break-word;
    hyphens: auto;
    text-align: center; /* Center text by default */
  }

  .card-front {
    background-color: #f0f0f0;
    color: #333;
  }

  .card-back {
    background-color: #e0e0e0;
    color: #333;
    transform: rotateY(180deg); /* Pre-rotate the back face */
  }

  .card-image {
    max-width: 80%;
    max-height: 45%; /* Adjusted to make space for button */
    margin-bottom: 8px; /* Adjusted margin */
    object-fit: contain;
  }

  .content-text {
    margin-bottom: 5px; /* Space between text and button */
    max-height: 70%; /* Allow text to take up most space */
    overflow-y: auto; /* Scroll if content overflows */
  }
  .example-text {
    margin-top: 8px; /* Consistent margin */
    font-size: 0.875rem; /* text-sm */
    font-style: italic;
    color: #4A5568; /* text-gray-600 */
    display: flex; /* For aligning text and button */
    align-items: center;
    justify-content: center; /* Center if it wraps */
    gap: 5px; /* Space between example text and its button */
  }
  .tts-button {
    background: none;
    border: none;
    font-size: 1.2rem; /* Larger icon */
    cursor: pointer;
    padding: 5px;
    line-height: 1; /* Prevent extra space from line height */
    color: #4A5568; /* Default color */
  }
  .tts-button:hover {
    color: #2C5282; /* Darker on hover */
  }
  .tts-button-back {
     /* Specific styles for back button if needed, e.g. positioning */
  }
  .tts-button-inline {
    background: none;
    border: none;
    font-size: 0.9rem; /* Slightly smaller for inline */
    cursor: pointer;
    padding: 0 3px;
    line-height: 1;
    color: #4A5568;
  }
  .tts-button-inline:hover {
    color: #2C5282;
  }

</style>
