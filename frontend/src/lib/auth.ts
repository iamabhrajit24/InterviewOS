import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
}

export function getUserFromRequest(request: NextRequest): AuthenticatedUser | null {
  try {
    // 1. Try Cookie
    let token = request.cookies.get('auth_token')?.value;

    // 2. Try Authorization Header
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    return decoded;
  } catch (error) {
    console.error('JWT Verification error:', error);
    return null;
  }
}

export function getUserIdFromSession(): string {
  // Return a mock or stored user id for client-side fallbacks if not fully signed in
  if (typeof window !== 'undefined') {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      try {
        const u = JSON.parse(userJson);
        if (u && u.id) return u.id;
      } catch (_) {}
    }
  }
  return 'default_mock_user_id';
}
