import bcrypt from 'bcrypt';
import * as userRepository from '@/repositories/userRepository';
import { LoginAttemptsExceededError } from '@/domain/errors';
import {
  getRateLimitStore,
  setRateLimitStore as setRateLimitStoreBase,
  type RateLimitStore,
} from '@/lib/rate-limit-store';
import {
  getLoginRateLimitMaxAttempts,
  getLoginRateLimitWindowMs,
} from '@/config/rate-limit';

const rateLimitStore = getRateLimitStore();

export function setRateLimitStore(store: RateLimitStore): void {
  setRateLimitStoreBase(store);
}

async function clearFailedAttempts(username: string) {
  await rateLimitStore.recordSuccessfulAttempt(username);
}

async function recordFailedAttempt(username: string) {
  const blocked = await rateLimitStore.recordFailedAttempt(
    username,
    getLoginRateLimitWindowMs(),
    getLoginRateLimitMaxAttempts()
  );

  if (blocked) {
    throw new LoginAttemptsExceededError();
  }
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; username: string; role: string; branchId: number; branchName: string } | null> {
  // Bloqueo preventivo: una vez alcanzado el máximo de intentos, ni siquiera
  // la contraseña correcta deja entrar hasta que expire la ventana. Antes el
  // lockout solo cortaba el siguiente intento fallido, así que una clave
  // válida seguía entrando en pleno bloqueo.
  if (
    await rateLimitStore.isBlocked(
      username,
      getLoginRateLimitWindowMs(),
      getLoginRateLimitMaxAttempts()
    )
  ) {
    throw new LoginAttemptsExceededError();
  }

  const user = await userRepository.findByUsernameWithBranch(username);

  if (!user) {
    await recordFailedAttempt(username);
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    await recordFailedAttempt(username);
    return null;
  }

  await clearFailedAttempts(username);

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    branchName: user.branch?.name ?? '',
  };
}
