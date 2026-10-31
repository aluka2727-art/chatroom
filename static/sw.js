self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let notification = {};
    try {
      notification = event.data ? event.data.json() : {};
    } catch {
      notification = { title: "PIGIN", body: "You have a new message." };
    }

    const title = notification.title || "PIGIN";
    const options = {
      body: notification.body || "You have a new message.",
      icon: "/static/icon-192.png?v=pigin-logo",
      badge: "/static/icon-192.png?v=pigin-logo",
      data: { url: notification.url || "/" },
      tag: notification.tag || "pigin-message",
    };
    if (notification.tag) options.renotify = true;

    const tasks = [self.registration.showNotification(title, options)];
    const badgeCount = notification.badgeCount;
    if (Number.isInteger(badgeCount)) {
      if (badgeCount > 0 && navigator.setAppBadge) tasks.push(navigator.setAppBadge(badgeCount));
      else if (navigator.clearAppBadge) tasks.push(navigator.clearAppBadge());
    }
    await Promise.all(tasks);

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: "unread-refresh" });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      client.postMessage({ type: "open-target", url: targetUrl });
      await client.focus();
      if (typeof client.navigate === "function") {
        try {
          await client.navigate(targetUrl);
        } catch {
          // The open page follows the open-target message when navigation is unavailable.
        }
      }
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});
