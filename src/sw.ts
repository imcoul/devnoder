/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
declare const self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push notifications (Sprint 7 — PR reviews, mentions) ─────
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? { title: 'DevNoder', body: 'New notification' };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'DevNoder', {
      body:   data.body,
      icon:   '/icons/icon-192.png',
      badge:  '/icons/icon-72.png',
      tag:    data.tag ?? 'devnoder',
      data:   data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
