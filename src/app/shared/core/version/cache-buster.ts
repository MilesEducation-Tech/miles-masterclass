/**
 * Best-effort cache clear + hard reload, used by the "Update now" action.
 *
 * Clears the Cache Storage API and unregisters any service workers, then
 * reloads. With content-hashed bundles and server-rendered HTML, the reload
 * fetches fresh markup that points at the new bundle files — so the user ends
 * up on the just-deployed version.
 */
export async function clearCachesAndReload(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Clearing caches is best-effort — reload regardless so the user isn't stuck.
  } finally {
    window.location.reload();
  }
}
