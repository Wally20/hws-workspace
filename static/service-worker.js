self.HWS_WORKSPACE_RELEASE = "2026-07-22-exercise-layout-3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.claim().then(async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(
        clients.map((client) => {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin !== self.location.origin || typeof client.navigate !== "function") {
            return undefined;
          }
          clientUrl.searchParams.set("app-release", self.HWS_WORKSPACE_RELEASE);
          return client.navigate(clientUrl.href);
        })
      );
    })
  );
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

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
