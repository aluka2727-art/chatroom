self.addEventListener("push", event => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { title: "PIGIN", body: "You have a new direct message." };
  }

  const title = notification.title || "PIGIN";
  const options = {
    body: notification.body || "You have a new direct message.",
    icon: "/static/icon-192.png",
    badge: "/static/icon-192.png",
    data: { url: notification.url || "/?view=dms" },
    tag: notification.tag || "pigin-direct-message",
  };
  if (notification.tag) options.renotify = true;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/?view=dms", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      client.postMessage({ type: "open-dm", url: targetUrl });
      await client.focus();
      if (typeof client.navigate === "function") {
        try {
          await client.navigate(targetUrl);
        } catch {
          // The open page follows the open-dm message when navigation is unavailable.
        }
      }
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});