// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '$lib/utils/authUtils';

const prisma = new PrismaClient(); // Global instance

export const handle: Handle = async ({ event, resolve }) => {
  // Handle OPTIONS request for CORS preflight
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*', // Adjust for your actual origin in production
				'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add Authorization if you use Bearer tokens in headers
        'Access-Control-Allow-Credentials': 'true',
			}
		});
	}

  // --- Authentication Logic ---
  const token = event.cookies.get('authToken');
  event.locals.user = null; // Initialize user on locals

  if (token) {
    const decoded = verifyToken(token); // verifyToken should handle expired tokens and return null
    if (decoded && decoded.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, createdAt: true } // Select only necessary, non-sensitive fields
        });
        if (user) {
          event.locals.user = user;
        }
      } catch (error) {
        console.error('Error fetching user in hook:', error);
        // Potentially clear the cookie if user lookup fails for a valid-looking token
        // event.cookies.delete('authToken', { path: '/' });
      }
    } else if (decoded === null) { // Token was invalid or expired
        // Optionally delete the invalid/expired cookie
        // event.cookies.delete('authToken', { path: '/' });
    }
  }
  // --- End Authentication Logic ---

	const response = await resolve(event);

  // Apply CORS headers to actual responses
	response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for your actual origin in production
	response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE, PATCH');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');


	return response;
};

// Proper Prisma client disconnect.
// This is tricky in hooks as they run per request in dev, but are long-lived in prod.
// A global Prisma instance usually manages its own connections.
// If you were creating PrismaClient() inside handle, you'd need to disconnect.
// For a global one, this is generally not needed here.
// process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
// process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });