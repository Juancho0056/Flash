import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    // Clear the authentication cookie by setting its value to empty and expiry to a past date
    cookies.set('authToken', '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0), // Set expiry to a past date
    });

    return json({ message: 'Logout successful.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error processing logout request:', error);
    return json({ error: 'An unexpected error occurred during logout.' }, { status: 500 });
  }
};

// Optionally, you might want a GET handler if you allow logout via GET,
// but POST is generally preferred for actions that change state (even if it's just clearing a cookie).
// export const GET: RequestHandler = async ({ cookies }) => {
//   // Same logic as POST
//   cookies.set('authToken', '', {
//     path: '/',
//     expires: new Date(0),
//   });
//   return json({ message: 'Logout successful (via GET).' }, { status: 200 });
// };
