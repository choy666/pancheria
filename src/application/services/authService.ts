import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; username: string } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) return null;

  return { id: user.id, username: user.username };
}
