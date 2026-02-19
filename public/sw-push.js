// Push notification handler for MTWallet service worker
// This file is injected into the Workbox-generated service worker

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch {
        data = {
            title: 'MTWallet',
            body: event.data.text(),
        };
    }

    const title = data.title || 'MTWallet';
    const options = {
        body: data.body || 'New transactions synced',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'sync-notification',
        renotify: true,
        data: {
            url: data.url || '/transactions',
            syncRunId: data.syncRunId,
        },
        actions: [
            { action: 'view', title: 'View Transactions' },
            { action: 'dismiss', title: 'Dismiss' },
        ],
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/transactions';

    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if one is open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            return clients.openWindow(url);
        })
    );
});
