import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// VAPID public key generated for this app
const VAPID_PUBLIC_KEY = 'BG46OyHptYAJwN-PewTCMCHG7MqU9tp-05mC-oBYHYlb0KmHdycNZW8mxRQK4DimoDf0qv8HliuxgnJgMTGRe4o';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
    const { user } = useAuth();
    const [permissionState, setPermissionState] = useState<PushPermissionState>('prompt');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    // Check current state on mount
    useEffect(() => {
        if (!isSupported) {
            setPermissionState('unsupported');
            setIsLoading(false);
            return;
        }

        setPermissionState(Notification.permission as PushPermissionState);

        // Check if already subscribed
        navigator.serviceWorker.ready.then(async (registration) => {
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
            setIsLoading(false);
        }).catch(() => {
            setIsLoading(false);
        });
    }, [isSupported]);

    const subscribe = useCallback(async () => {
        if (!isSupported || !user) return false;

        try {
            setIsLoading(true);

            // Request notification permission
            const permission = await Notification.requestPermission();
            setPermissionState(permission as PushPermissionState);

            if (permission !== 'granted') {
                setIsLoading(false);
                return false;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            const subscriptionJSON = subscription.toJSON();

            // Store in Supabase
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscriptionJSON.endpoint!,
                    p256dh: subscriptionJSON.keys!.p256dh!,
                    auth: subscriptionJSON.keys!.auth!,
                }, {
                    onConflict: 'user_id,endpoint',
                });

            if (error) {
                console.error('Failed to store push subscription:', error);
                setIsLoading(false);
                return false;
            }

            setIsSubscribed(true);
            setIsLoading(false);
            return true;
        } catch (err) {
            console.error('Push subscription failed:', err);
            setIsLoading(false);
            return false;
        }
    }, [isSupported, user]);

    const unsubscribe = useCallback(async () => {
        if (!isSupported || !user) return false;

        try {
            setIsLoading(true);

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Remove from Supabase
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('endpoint', subscription.endpoint);

                // Unsubscribe from push manager
                await subscription.unsubscribe();
            }

            setIsSubscribed(false);
            setIsLoading(false);
            return true;
        } catch (err) {
            console.error('Push unsubscribe failed:', err);
            setIsLoading(false);
            return false;
        }
    }, [isSupported, user]);

    return {
        isSupported,
        permissionState,
        isSubscribed,
        isLoading,
        subscribe,
        unsubscribe,
    };
}
