import { json, type RequestHandler } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { comparePassword, generateToken } from '$lib/utils/authUtils'; // Added generateToken

const prisma = new PrismaClient();

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    // --- Input Validation ---
    if (!email || !password) {
      return json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Basic email format validation (optional, can rely on DB check mostly)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      // Or, more generically for login, just proceed and let the user not be found
      // return json({ error: 'Invalid email format.' }, { status: 400 });
    }

    // --- Find the user ---
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    } catch (dbError) {
      console.error('Database error finding user:', dbError);
      return json({ error: 'An error occurred. Please try again later.' }, { status: 500 });
    }

    if (!user) {
      return json({ error: 'Invalid credentials.' }, { status: 401 }); // User not found
    }

    // --- Compare the password ---
    let passwordMatch = false;
    try {
        passwordMatch = await comparePassword(password, user.password);
    } catch (compareError) {
        console.error('Error comparing password:', compareError);
        return json({ error: 'An error occurred during login processing.' }, { status: 500 });
    }


    if (!passwordMatch) {
      return json({ error: 'Invalid credentials.' }, { status: 401 }); // Password does not match
    }

    // --- Handle successful login ---
    const tokenPayload = { userId: user.id };
    const token = generateToken(tokenPayload); // Default expiration is 7 days

    cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: 'lax', // CSRF protection
      path: '/', // Cookie available for all paths
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    });

    const { password: _, ...userWithoutPassword } = user;
    return json({ user: userWithoutPassword, message: 'Login successful.' }, { status: 200 });

  } catch (error: any) {
    // Catch any other errors, e.g., if request.json() fails
    console.error('Error processing login request:', error);
    if (error instanceof SyntaxError) { // Error parsing JSON
        return json({ error: 'Invalid request data format.' }, { status: 400 });
    }
    return json({ error: 'An unexpected error occurred.' }, { status: 500 });
  } finally {
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma client", e));
  }
};
