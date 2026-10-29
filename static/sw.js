self.addEventListener("push", event => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { title: "PIGIN", body: "You have a new direct message." };
  }

  event.waitUntil(self.registration.showNotification(notification.title || "PIGIN", {
    body: notification.body || "You have a new direct message.",
    icon: "/static/icon-192.png",
    badge: "/static/icon-192.png",
    data: { url: notification.url || "/?view=dms" },
    tag: "pigin-direct-message",
    renotify: true,
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/?view=dms", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        await client.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});