import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../state/provider';
import { notificationHandler } from '../services/notifications';
import { color } from '../theme/tokens';

Notifications.setNotificationHandler(notificationHandler);

/**
 * A reminder is only worth sending if tapping it lands on the page that
 * answers it. The route travels in the notification's data, so the same code
 * covers a tap while the app is open and a tap that launches it cold.
 */
function useNotificationRouting() {
  const router = useRouter();
  const navigation = useRootNavigationState();
  const [pending, setPending] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const accept = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;
      Notifications.clearLastNotificationResponse();
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string') setPending(route);
    };
    Notifications.getLastNotificationResponseAsync().then(accept).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(accept);
    return () => subscription.remove();
  }, []);

  /** The navigator does not exist during the first render, so wait for its key. */
  useEffect(() => {
    if (!pending || !navigation?.key) return;
    setPending(null);
    router.push(pending as never);
  }, [navigation?.key, pending, router]);
}

export default function RootLayout() {
  useNotificationRouting();
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.paper },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="session" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
          <Stack.Screen name="skip" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="form/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="movements" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="movements/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="review" />
          <Stack.Screen name="log" />
          <Stack.Screen name="settings" />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
