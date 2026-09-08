self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Namma Idli", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "New order";
  const options = {
    body: data.body || "",
    icon: "/namma-idli-new.svg",
    badge: "/namma-idli-new.svg",
    tag: data.order_id ? `order-${data.order_id}` : undefined,
    data: { orderId: data.order_id },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
