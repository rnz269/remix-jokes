import bcrypt from 'bcryptjs';

import { db } from './db.server';

type LoginForm = {
  username: string;
  password: string;
};

// define a function that accepts a username and password
export async function login({ username, password }: LoginForm) {
  // first check if username exists. if not, return error
  const user = await db.user.findUnique({
    where: { username },
  });

  if (!user) return null;

  // if the username exists, then:
  // use bcrypt to see if there's a match btw hash(provided password) and db pw hash
  const isCorrectPassword = await bcrypt.compare(password, user.passwordHash);

  // if passwords don't match, return null
  if (!isCorrectPassword) return null;

  // if passwords match, return the user
  return { id: user.id, username };
}
