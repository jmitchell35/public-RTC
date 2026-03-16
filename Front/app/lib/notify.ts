'use client';

/**
 * Show a system notification.
 * In Tauri: uses native OS notifications via the plugin.
 * In browser: uses the Web Notifications API.
 */
export async function sendNotification(title: string, body: string): Promise<void> {
    // Check if running inside Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
            const { sendNotification: tauriNotify } = await import('@tauri-apps/plugin-notification');
            tauriNotify({ title, body });
        } catch (error) {
            console.warn('Tauri notification failed', error);
        }
        return;
    }

    // Fallback: browser Notification API
    if (typeof Notification === 'undefined') {
        return;
    }
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification(title, { body });
        }
    }
}
