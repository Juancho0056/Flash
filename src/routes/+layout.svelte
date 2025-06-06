<script lang="ts">
	import '../app.css';
	import ToastsContainer from '$lib/components/ToastsContainer.svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;
	let isMobileMenuOpen = false;

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
	<header class="relative bg-gray-800 p-4 text-white shadow-md">
		<nav class="container mx-auto flex items-center justify-between">
			<a href="/" class="text-xl font-semibold hover:text-gray-300">Flashcard App</a>

			<!-- Mobile Menu Button -->
			<div class="md:hidden">
				<button
					on:click={() => (isMobileMenuOpen = !isMobileMenuOpen)}
					aria-label="Toggle menu"
					aria-expanded={isMobileMenuOpen}
					aria-controls="main-nav-menu"
					class="rounded p-2 text-white hover:bg-gray-700 focus:ring-2 focus:ring-white focus:outline-none focus:ring-inset"
				>
					{#if isMobileMenuOpen}
						<!-- Close Icon (X) -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					{:else}
						<!-- Hamburger Icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					{/if}
				</button>
			</div>

			<!-- Navigation -->
			<ul
				id="main-nav-menu"
				class="md:flex md:items-center md:space-x-4 ${isMobileMenuOpen
					? 'absolute top-full left-0 z-20 flex w-full flex-col space-y-2 bg-gray-700 p-4 shadow-lg md:static md:w-auto md:flex-row md:space-y-0 md:bg-transparent md:p-0 md:shadow-none'
					: 'hidden'}"
			>
				<li>
					<a
						href="/"
						class="block rounded px-3 py-2 hover:bg-gray-700 md:hover:bg-transparent md:hover:text-gray-300"
						>Home</a
					>
				</li>
				{#if data.user}
					<li>
						<span class="block rounded px-3 py-2 text-gray-400 md:text-gray-400"
							>Logged in as {data.user.email}</span
						>
					</li>
					<li>
						<span class="block rounded px-3 py-2 font-bold text-yellow-400 md:text-yellow-400"
							>Total Score: {data.totalAccumulatedScore}</span
						>
					</li>
					<li>
						<button
							on:click={handleLogout}
							class="block w-full rounded px-3 py-2 text-left hover:bg-gray-700 md:w-auto md:text-left md:hover:bg-transparent md:hover:text-gray-300"
							>Logout</button
						>
					</li>
				{:else}
					<li>
						<a
							href="/auth/login"
							class="block rounded px-3 py-2 hover:bg-gray-700 md:hover:bg-transparent md:hover:text-gray-300"
							>Login</a
						>
					</li>
					<li>
						<a
							href="/auth/register"
							class="block rounded px-3 py-2 hover:bg-gray-700 md:hover:bg-transparent md:hover:text-gray-300"
							>Register</a
						>
					</li>
				{/if}
				<li>
					<a
						href="/history"
						class="block rounded px-3 py-2 hover:bg-gray-700 md:hover:bg-transparent md:hover:text-gray-300"
						>History</a
					>
				</li>
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
