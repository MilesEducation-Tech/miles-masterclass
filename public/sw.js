// Retires the Netcore web-push worker that earlier builds registered at /sw.js
// (analytics removed, MIL-XXX). A browser that still has it re-fetches this file
// on its next visit, installs it, and it unregisters itself, taking the push
// subscription with it. No fetch handler, so it never touches a request.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.registration.unregister()));
