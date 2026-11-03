import { PASSWORD_MAX_BYTES, PASSWORD_MIN } from '@core/models/password.model';
import { PasswordPolicyBreach } from '@features/auth/models/set-password.model';

/**
 * The policy the contract states, checked before a round trip: 8 to 72 UTF-8 bytes, a letter and a
 * number. Lenient on purpose (any script's letters and digits count): it must never refuse what the
 * SSO accepts. The SSO stays the authority and refuses more ("one character repeated", the email),
 * answering `password_policy` with its own message.
 */
export function passwordPolicyBreach(value: string): PasswordPolicyBreach | null {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < PASSWORD_MIN) return 'short';
  if (bytes > PASSWORD_MAX_BYTES) return 'long';
  if (!/\p{L}/u.test(value)) return 'letter';
  if (!/\p{N}/u.test(value)) return 'digit';
  return null;
}
