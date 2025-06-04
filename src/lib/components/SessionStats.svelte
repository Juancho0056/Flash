<script lang="ts">
  import { studyStats } from '$lib/stores/studyStats';
  $: stats = $studyStats;
</script>

<div class="text-sm mt-2 bg-gray-100 p-3 rounded">
  <p><strong>Viewed:</strong> {stats.totalViewed}</p>
  <p><strong>Correct:</strong> {stats.totalCorrect}</p>
  <p><strong>Incorrect:</strong> {stats.totalIncorrect}</p>
  <p><strong>Streak:</strong> {stats.correctStreak}</p>
  <p><strong>Longest Streak:</strong> {stats.longestStreak}</p>
</div>