import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
            registerType: 'autoUpdate',
            devOptions: {
              enabled: true,
              suppressWarnings: true,
              type: 'module',
              navigateFallback: '/',
            },
            manifest: {
                name: 'My Flashcards App',
                short_name: 'Flashcards',
                description: 'A PWA for studying flashcards.',
                theme_color: '#ffffff',
                background_color: '#f0f0f0',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                icons: [
                    {
                        src: 'favicon.png',
                        sizes: '192x192',
                        type: 'image/png'
                    }
                    // {
                    //    src: 'pwa-512x512.png',
                    //    sizes: '512x512',
                    //    type: 'image/png'
                    // }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
                runtimeCaching: [
                    {
                        urlPattern: ({url}) => url.pathname.startsWith('/api'),
                        handler: 'NetworkFirst' as const,
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 // 1 day
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        })
	],
	server: {
		cors: true
	}
});
