// EM3 service worker: makes the app installable and lets it open offline.
// Only same-origin GETs are handled; E3 API calls and fonts go straight to the network
// (E3 data is already persisted by TanStack Query in IndexedDB).
//
// - Page loads: network first, falling back to the cached shell when offline.
// - /assets/*: file names carry a content hash, so cache first.
// - Everything else (icons, screenshots): serve the cache, refresh it in the background.

const SHELL = "em3-shell-v1";
// The dev server registers `sw.js?dev` only for push; caching would serve stale Vite modules.
const DEV = new URL(self.location.href).searchParams.has("dev");
const ASSETS = "em3-assets-v1";
const MAX_ASSETS = 150;

self.addEventListener("install", event => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then(c => c.addAll(["./", "./manifest.webmanifest", "./favicon.svg", "./icon-192.png"]))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", event => {
	event.waitUntil(
		caches
			.keys()
			.then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", event => {
	const req = event.request;
	const url = new URL(req.url);
	if (DEV || req.method !== "GET" || url.origin !== self.location.origin) return;

	if (req.mode === "navigate") {
		event.respondWith(
			fetch(req)
				.then(res => {
					if (res.ok) {
						const copy = res.clone();
						void caches.open(SHELL).then(c => c.put("./", copy));
					}
					return res;
				})
				.catch(() => caches.match("./", { cacheName: SHELL }).then(r => r ?? Response.error()))
		);
		return;
	}

	if (url.pathname.startsWith("/assets/")) {
		event.respondWith(
			caches.match(req, { cacheName: ASSETS }).then(
				hit =>
					hit ??
					fetch(req).then(res => {
						if (res.ok) {
							const copy = res.clone();
							void caches.open(ASSETS).then(async c => {
								await c.put(req, copy);
								const keys = await c.keys();
								await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map(k => c.delete(k)));
							});
						}
						return res;
					})
			)
		);
		return;
	}

	event.respondWith(
		caches.open(SHELL).then(async c => {
			const hit = await c.match(req);
			const fresh = fetch(req)
				.then(res => {
					if (res.ok) void c.put(req, res.clone());
					return res;
				})
				.catch(() => hit ?? Response.error());
			return hit ?? fresh;
		})
	);
});

// Reminders from the EM3 server (worker/notify): the payload is { title, body, url, tag }.
self.addEventListener("push", event => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : "" };
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "EM3", {
			body: data.body || "",
			icon: "/icon-192.png",
			badge: "/icon-192.png",
			tag: data.tag,
			// A reminder for the same item replaces the earlier one but still alerts.
			renotify: !!data.tag,
			data: { url: data.url || "/" },
			lang: data.lang
		})
	);
});

self.addEventListener("notificationclick", event => {
	event.notification.close();
	// Only EM3's own pages; anything else in the payload opens the app's home.
	let target = new URL("/", self.location.origin);
	try {
		const u = new URL(event.notification.data?.url || "/", self.location.origin);
		if (u.origin === self.location.origin) target = u;
	} catch {
		// Keep the home page.
	}
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
			const open = windows.find(w => new URL(w.url).origin === target.origin);
			if (open) {
				await open.focus();
				// Hash routes: navigating to the same page with a new hash just changes the route.
				if (open.url !== target.href && "navigate" in open) await open.navigate(target.href).catch(() => {});
				return;
			}
			await self.clients.openWindow(target.href);
		})
	);
});
