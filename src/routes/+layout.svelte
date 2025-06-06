<script lang="ts">
	import '../app.css';
	import ToastsContainer from '$lib/components/ToastsContainer.svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	async function handleLogout() {
		const response = await fetch('/api/auth/logout', { method: 'POST' });
		if (response.ok) {
			await goto('/', { invalidateAll: true });
		} else {
			alert('Logout failed. Please try again.');
		}
	}
</script>

<ToastsContainer />

<div class="main-content flex min-h-screen flex-col">
	<header class="bg-gray-800 p-4 text-white shadow-md">
		<nav class="container mx-auto flex items-center justify-between">
			<a href="/" class="text-xl font-semibold hover:text-gray-300">Flashcard App</a>
			<ul class="flex space-x-4">
				<li><a href="/" class="hover:text-gray-300">Home</a></li>
				{#if data.user}
					<li><span class="text-gray-400">Logged in as {data.user.email}</span></li>
					<li><span class="text-yellow-400 font-bold">Total Score: {data.totalAccumulatedScore}</span></li>
					<li>
						<button on:click={handleLogout} class="underline hover:text-gray-300">Logout</button>
					</li>
				{:else}
					<li><a href="/auth/login" class="hover:text-gray-300">Login</a></li>
					<li><a href="/auth/register" class="hover:text-gray-300">Register</a></li>
				{/if}
				<li><a href="/history" class="hover:text-gray-300">History</a></li>
			</ul>
		</nav>
	</header>
	<main class="container mx-auto flex-grow p-4 md:p-8">
		<slot />
	</main>
	<footer class="bg-gray-100 p-4 text-center text-sm text-gray-600">
		© {new Date().getFullYear()} Flashcard App. All rights reserved.
	</footer>
</div>
