import bcrypt from 'bcryptjs';
import { createCookieSessionStorage, redirect } from 'remix';

import { db } from './db.server';

type LoginForm = {
  username: string;
  password: string;
};

// define a function that accepts a username and password
export async function login({ username, password }: LoginForm) {
  // first check if username exists.
  const user = await db.user.findUnique({
    where: { username },
  });

  // if user doesn't exist, return
  if (!user) return null;

  // if the username exists, then:
  // use bcrypt to see if there's a match btw hash(provided password) and db pw hash
  const isCorrectPassword = await bcrypt.compare(password, user.passwordHash);

  // if passwords don't match, return null
  if (!isCorrectPassword) return null;

  // if passwords match, return the user
  return { id: user.id, username };
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set');
}

// Creates and returns a SessionStorage object
// that stores all session data directly in the session cookie itself.
const storage = createCookieSessionStorage({
  cookie: {
    name: 'RJ_session',
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

// gets the cookie-session from the request
function getUserSession(request: Request) {
  return storage.getSession(request.headers.get('Cookie'));
}

// parses the cookie-session from the request, returning the userId or null if DNE
export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get('userId');

  if (!userId || typeof userId !== 'string') return null;
  return userId;
}

// requires that the request has the userId, returning userId or redirecting if DNE
export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getUserSession(request);
  const userId = session.get('userId');

  if (!userId || typeof userId !== 'string') {
    // get the page they were trying to access
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    // redirect to login, but supply the page they were trying to access
    // so that once they login, we can redirect them to that page
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

// get info on the user
export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== 'string') {
    return null;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    return user;
  } catch {
    throw logout(request);
  }
}

// log out the user by destroying the cookie-session
export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect('/login', {
    headers: {
      'Set-Cookie': await storage.destroySession(session),
    },
  });
}

// creates the cookie-session, storing the userId property in it
export async function createUserSession(userId: string, redirectTo: string) {
  // get the SessionStorage object we created above in this file
  const session = await storage.getSession();

  // set the userId property on the session object
  session.set('userId', userId);

  // commit the changes to the session.
  // commitSession provides set-cookie header for outgoing response
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await storage.commitSession(session),
    },
  });
}
