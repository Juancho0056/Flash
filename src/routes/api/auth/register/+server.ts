import { json, type RequestHandler } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '$lib/utils/authUtils';

const prisma = new PrismaClient();

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password }
 = body;

    // --- Input Validation ---
    if (!email || !password) {
      return json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Basic email format validation (more robust validation might be needed for production)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ error: 'Invalid email format.' }, { status: 400 });
    }

    // Basic password complexity (e.g., minimum length)
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }
    // Add more complexity rules if needed (e.g., uppercase, number, special character)

    // --- Check if user already exists ---
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }, // Store and check email in lowercase
      });

      if (existingUser) {
        return json({ error: 'User with this email already exists.' }, { status: 409 }); // 409 Conflict
      }
    } catch (dbError) {
      console.error('Database error checking existing user:', dbError);
      return json({ error: 'Failed to verify user information. Please try again later.' }, { status: 500 });
    }

    // --- Hash the password ---
    let hashedPassword;
    try {
      hashedPassword = await hashPassword(password);
    } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return json({ error: 'An error occurred during registration processing.'}, { status: 500 });
    }


    // --- Create the new user ---
    try {
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(), // Store email in lowercase
          password: hashedPassword,
        },
      });

      // Return user data (excluding password)
      const { password: _, ...userWithoutPassword } = newUser;
      return json({ user: userWithoutPassword, message: 'User registered successfully.' }, { status: 201 });

    } catch (dbError) {
      console.error('Database error creating new user:', dbError);
      // Log the specific Prisma error code if available e.g. P2002 for unique constraint
      // if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
      //   return json({ error: 'User with this email already exists (database check).' }, { status: 409 });
      // }
      return json({ error: 'Failed to create user. Please try again later.' }, { status: 500 });
    }

  } catch (error: any) {
    // Catch any other errors, e.g., if request.json() fails
    console.error('Error processing registration request:', error);
    if (error instanceof SyntaxError) { // Error parsing JSON
        return json({ error: 'Invalid request data format.' }, { status: 400 });
    }
    return json({ error: 'An unexpected error occurred.' }, { status: 500 });
  } finally {
    await prisma.$disconnect().catch(e => console.error("Failed to disconnect Prisma client", e));
  }
};
