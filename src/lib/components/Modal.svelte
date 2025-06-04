<!-- src/components/Modal.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition'; // For animations

	export let isOpen = false;
	export let title = 'Confirmation';
	export let message = 'Are you sure?';
	export let confirmText = 'Confirm';
	export let cancelText = 'Cancel';
	export let isLoading = false; // For showing loading state on confirm button

	const dispatch = createEventDispatcher();

	function handleConfirm() {
		if (isLoading) return;
		dispatch('confirm');
	}

	function handleCancel() {
		if (isLoading) return;
		dispatch('cancel');
		// Parent should control isOpen state primarily
	}

	// Handle Escape key to close modal
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			handleCancel();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
		on:click|self={handleCancel}
	>
		<div
			class="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			aria-describedby="modal-message"
			transition:fly={{ y: -30, duration: 200, opacity: 0 }}
		>
			<h2 id="modal-title" class="mb-4 text-xl font-semibold text-gray-800">{title}</h2>

			<p id="modal-message" class="mb-6 whitespace-pre-wrap text-gray-600">{message}</p>

			<div class="flex justify-end space-x-4">
				<button
					on:click={handleCancel}
					disabled={isLoading}
					class="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
				>
					{cancelText}
				</button>
				<button
					on:click={handleConfirm}
					disabled={isLoading}
					class="flex items-center justify-center rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60"
				>
					{#if isLoading}
						<svg
							class="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Processing...
					{:else}
						{confirmText}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
