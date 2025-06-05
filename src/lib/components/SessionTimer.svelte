<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let startTime: number;

  let elapsedTimeFormatted: string = '00:00';
  let intervalId: any;

  function formatDuration(ms: number): string {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const paddedMinutes = minutes.toString().padStart(2, '0');
    const paddedSeconds = seconds.toString().padStart(2, '0');

    if (hours > 0) {
      const paddedHours = hours.toString().padStart(2, '0');
      return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    }
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  function updateElapsedTime() {
    if (startTime) {
      const now = Date.now();
      elapsedTimeFormatted = formatDuration(now - startTime);
    } else {
      elapsedTimeFormatted = '00:00'; // Or some other default if startTime isn't valid
    }
  }

  onMount(() => {
    updateElapsedTime(); // Initial update
    intervalId = setInterval(updateElapsedTime, 1000);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Reactive statement to reset timer if startTime changes
  $: if (startTime) {
    updateElapsedTime();
  }

</script>

<div class="session-timer text-sm text-gray-600">
  Session Time: <span class="font-medium tabular-nums">{elapsedTimeFormatted}</span>
</div>

<style>
  .session-timer {
    /* Basic styling, can be adjusted as needed */
    padding: 2px 4px;
    border-radius: 4px;
    /* background-color: #f0f0f0; */ /* Optional background */
  }
  .font-medium {
    font-weight: 500;
  }
  .tabular-nums {
    font-variant-numeric: tabular-nums; /* Ensures numbers take up the same space, preventing jitter */
  }
</style>
