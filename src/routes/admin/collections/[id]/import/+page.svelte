<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/toastStore';

	let file: File | null = null;
	let uploading = false;
	let successMessage: string | null = null;

	async function handleImport() {
		if (!file) {
			toast.error('Please select a file.');
			return;
		}

		uploading = true;
		successMessage = null;

		const formData = new FormData();
		formData.append('file', file);

		const collectionId = $page.params.id;

		try {
			const response = await fetch(`/api/collections/${collectionId}/import`, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to import.');
			}

			toast.success(`✅ Imported ${result.count} flashcards.`);
			successMessage = result.message;
		} catch (err: any) {
			toast.error(err.message || 'Error during import.');
		} finally {
			uploading = false;
		}
	}
</script>

<svelte:head>
	<title>Import Flashcards</title>
</svelte:head>

<div class="max-w-xl mx-auto p-6 bg-white shadow rounded-md">
	<h1 class="text-2xl font-bold mb-4 text-gray-800">Import Flashcards</h1>

	<p class="mb-3 text-gray-600">
		Upload an Excel file <code>.xlsx</code> with columns: <strong>question</strong>, <strong>answer</strong>, <em>(optional)</em> pronunciation, example, imageUrl.
	</p>

	<input
		type="file"
		accept=".xlsx"
		on:change={(e) => {
            const target = e.target;
            if (target && target instanceof HTMLInputElement) {
                file = target.files?.[0] ?? null;
            }
        }}
		class="mb-4 block w-full border border-gray-300 rounded-md p-2"
	/>

	<button
		on:click={handleImport}
		disabled={uploading || !file}
		class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
	>
		{uploading ? 'Uploading...' : 'Import Excel'}
	</button>

	{#if successMessage}
		<p class="mt-4 text-green-600 font-medium">{successMessage}</p>
	{/if}
	<a href="/" class="mt-6 inline-block text-blue-600 hover:underline">← Back to collections</a>
</div>
