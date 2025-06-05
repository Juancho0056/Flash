import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a password using bcrypt.
 * @param password The plain text password.
 * @returns A promise that resolves to the hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

/**
 * Compares a plain text password with a hash.
 * @param password The plain text password.
 * @param hash The hashed password to compare against.
 * @returns A promise that resolves to true if the passwords match, false otherwise.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
}

// --- JWT Functions ---
import jwt from 'jsonwebtoken';

// Ensure JWT_SECRET is defined in your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev-only-please-change';
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'fallback-secret-key-for-dev-only-please-change') {
  console.warn('WARNING: Using fallback JWT secret in production. Please set a strong JWT_SECRET environment variable.');
}


interface JwtPayload {
  userId: string;
  // You can add other fields to the payload if needed, e.g., roles, email
  //iat?: number; // Issued at - automatically added by jwt.sign
  //exp?: number; // Expiration time - automatically added by jwt.sign
}

/**
 * Generates a JWT for a given user ID.
 * @param payload The data to include in the token, typically { userId: string }.
 * @param expiresIn The expiration time for the token (e.g., '1h', '7d'). Defaults to '7d'.
 * @returns The generated JWT.
 */
export function generateToken(payload: JwtPayload, expiresIn: string = '7d'): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined. Cannot generate token.');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verifies a JWT and returns its decoded payload.
 * @param token The JWT to verify.
 * @returns The decoded payload if the token is valid, otherwise null.
 */
export function verifyToken(token: string): JwtPayload | null {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined. Cannot verify token.');
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as JwtPayload; // Type assertion, ensure your payload structure matches
  } catch (error) {
    // console.error('Invalid or expired token:', error.message);
    return null; // Token is invalid or expired
  }
}
