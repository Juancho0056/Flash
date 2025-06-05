// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: { id: string; email: string; createdAt: Date } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}; // Ensures this file is treated as a module.
