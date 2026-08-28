self.HWS_WORKSPACE_RELEASE = "2026-08-26-safe-activation";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Claim open tabs without navigating them. Reloading here can discard text in
  // an unsaved form merely because a new service-worker version was deployed.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }

  const title = payload.title || "HWS Workspace";
  const options = {
    body: payload.body || "Er staat een nieuwe melding klaar.",
    icon: "/static/assets/hws-logo.png",
    badge: "/static/assets/hws-logo.png",
    tag: payload.tag || "hws-workspace",
    data: {
      url: payload.url || "/",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function getSafeNotificationUrl(rawUrl) {
  try {
    const targetUrl = new URL(rawUrl || "/", self.location.origin);
    if (
      targetUrl.origin === self.location.origin &&
      (targetUrl.protocol === "https:" || targetUrl.protocol === "http:")
    ) {
      return targetUrl.href;
    }
  } catch (error) {
    // Invalid and cross-origin notification targets safely fall back home.
  }
  return new URL("/", self.location.origin).href;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = getSafeNotificationUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
