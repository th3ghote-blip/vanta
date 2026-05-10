/**
 * lib/notifications.ts
 * Expo push token registration + permission helpers.
 *
 * Call registerForPushNotificationsAsync() once after the user's session is
 * established. It stores the token in profiles.push_token via Supabase so the
 * server can later call it (Phase 6.2).
 *
 * Fails silently on web and in simulators — those environments don't support
 * real push tokens. A console warning is emitted so developers know why.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Configure how notifications are presented while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request push-notification permissions, obtain an Expo push token, and
 * persist it to profiles.push_token.
 *
 * @param userId  The authenticated Supabase user id.
 * @returns       The push token string, or null if unavailable / denied.
 */
export async function registerForPushNotificationsAsync(
  userId: string
): Promise<string | null> {
  // Push tokens are not available on web.
  if (Platform.OS === 'web') {
    return null;
  }

  // Request / check permission.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push permission denied — token not registered.');
    return null;
  }

  // Obtain the Expo push token.
  let token: string | null = null;
  try {
    // projectId is required for managed workflow production builds.
    // Falls back to slug-based identification in Expo Go / dev client.
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId &&
      Constants.expoConfig.extra.eas.projectId !== 'TBD'
        ? Constants.expoConfig.extra.eas.projectId
        : undefined;

    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = result.data;
  } catch (err) {
    // Simulators / physical devices without EAS project configured will land here.
    console.warn('[notifications] Could not obtain push token:', err);
    return null;
  }

  if (!token) return null;

  // Persist to Supabase profiles.push_token.
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) {
    console.warn('[notifications] Failed to save push token to profiles:', error.message);
    // Don't throw — the app should still work without push.
    return null;
  }

  console.log('[notifications] Push token registered:', token.slice(0, 30) + '…');
  return token;
}

/**
 * Clear the push token from the DB on sign-out so stale tokens don't
 * accumulate (and so the server stops sending to this device).
 *
 * @param userId  The Supabase user id being signed out.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', userId);

  if (error) {
    console.warn('[notifications] Failed to clear push token on sign-out:', error.message);
  }
}
