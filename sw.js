// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

const CACHE_NAME = 'geoescape-v1';

// Core files to cache on install
const CORE_ASSETS = [
  '/index.html',
  '/game.html',
  '/editor.html',
  '/play.html',
  '/css/styles.css',
  '/manifest.json',
  '/robots.txt',
  '/js/core/db.js',
  '/js/core/geolocation.js',
  '/js/engine/assetResolver.js',
  '/js/engine/campaignParser.js',
  '/js/engine/inventory.js',
  '/js/engine/textOverlay.js',
  '/js/engine/dialogueBox.js',
  '/js/engine/stateMachine.js',
  '/js/engine/itemManager.js',
  '/js/engine/npcManager.js',
  '/js/engine/multiPickup.js',
  '/js/engine/renderer.js',
  '/js/engine/minigames.js',
  '/js/engine/simulator.js',
  '/js/engine/gpsmap.js',
  '/js/ui/components.js',
  '/assets/campaigns/demo.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).catch((err) => {
      console.warn('Failed to cache some assets:', err);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache First for static assets, Network for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip API calls and non-GET requests
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for offline
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
