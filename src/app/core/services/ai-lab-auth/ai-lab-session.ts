import { environment } from '@env/environment';
import type { Storage } from '@core/services/storage/storage';

/**
 * Email of the last account that signed in to AI Labs, so a repeat sign-in can skip the Microsoft
 * account picker. Derived from the session key rather than configured, since it is the same fact
 * scoped the same way.
 */
export const AI_LAB_LAST_EMAIL_KEY = `${environment.AI_LABS.storageKey}_EMAIL`;

/**
 * Everything the labs session is, as far as this browser is concerned.
 *
 * Free of `AiLabAuth` on purpose: `AuthSession.clear()` drops the labs session on every Miles
 * logout, and depending on the service would pull it (and its sign-in code) into the eager bundle
 * for every visitor. `Storage` no-ops on the server.
 */
export function clearAiLabSession(storage: Storage): void {
  storage.removeLocal(environment.AI_LABS.storageKey);
  storage.removeLocal(AI_LAB_LAST_EMAIL_KEY);
}
