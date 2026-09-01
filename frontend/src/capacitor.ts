import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = (): 'ios' | 'android' | 'web' =>
  Capacitor.getPlatform() as 'ios' | 'android' | 'web';

let initialized = false;
let secureStorageReady = false;

async function prepareSecureStorage() {
  if (!isNative() || secureStorageReady) return;
  const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage');
  await SecureStorage.setKeyPrefix('simp_');
  if (platform() === 'ios') {
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  }
  secureStorageReady = true;
}

export async function initNative(): Promise<void> {
  if (!isNative() || initialized) return;
  initialized = true;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#050505' });
  } catch {
    // Optional native chrome must never block app launch.
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // Splash may already be hidden by the native shell.
  }

  try {
    const { Keyboard, KeyboardResize, KeyboardStyle } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setStyle({ style: KeyboardStyle.Dark });
  } catch {
    // Keyboard customization is best effort.
  }

  try {
    await prepareSecureStorage();
  } catch {
    // Auth initialization will surface a secure-storage error if it is needed.
  }

  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', ({ url }) => {
      window.dispatchEvent(new CustomEvent('simp:deeplink', { detail: { url } }));
    });
  } catch {
    // Deep links remain available through normal web routing.
  }
}

export async function persistRefreshTokenNative(refresh: string | null): Promise<void> {
  if (!isNative()) return;
  await prepareSecureStorage();
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  if (refresh) await SecureStorage.setItem('refresh', refresh);
  else await SecureStorage.removeItem('refresh');
}

export async function hydrateRefreshTokenNative(): Promise<string | null> {
  if (!isNative()) return null;
  await prepareSecureStorage();
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  return SecureStorage.getItem('refresh');
}

export async function clearTokensNative(): Promise<void> {
  await persistRefreshTokenNative(null);
}

// Backward-compatible wrappers for code written before secure refresh-only storage.
export async function persistTokensNative(_access: string, refresh: string) {
  await persistRefreshTokenNative(refresh);
}
export async function hydrateTokensFromNative() {
  return { access: null, refresh: await hydrateRefreshTokenNative() };
}

export async function getDeviceContext(): Promise<{
  deviceId?: string;
  deviceName?: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
}> {
  if (!isNative()) return { platform: 'WEB' };
  try {
    const { Device } = await import('@capacitor/device');
    const [id, info] = await Promise.all([Device.getId(), Device.getInfo()]);
    return {
      deviceId: id.identifier,
      deviceName: [info.manufacturer, info.model].filter(Boolean).join(' ').slice(0, 120),
      platform: platform() === 'ios' ? 'IOS' : 'ANDROID',
    };
  } catch {
    return { platform: platform() === 'ios' ? 'IOS' : 'ANDROID' };
  }
}

/**
 * Register for native push notifications and forward the device token
 * to the SIMP backend. Returns one of:
 *   - `'granted'`   permission granted and registration started
 *   - `'denied'`    permission was refused
 *   - `'unsupported'` running on web (no native push available), or the
 *                    FCM plugin is missing / Firebase isn't configured
 *
 * Uses `@capacitor-firebase/messaging` so both iOS and Android get a
 * Firebase Cloud Messaging token. The FCM token is what the backend's
 * `firebase-admin/messaging.send()` consumes — Firebase then routes to
 * APNs on iOS automatically, so no APNs HTTP/2 client is needed on the
 * backend.
 *
 * iOS requires:
 *   - `GoogleService-Info.plist` in `frontend/ios/App/` (drag into Xcode)
 *   - An APNs Auth Key (.p8) uploaded to the Firebase Cloud Messaging
 *     console for the iOS app id `app.simp.client`.
 *
 * Android requires:
 *   - `google-services.json` in `frontend/android/app/`
 *   - The `com.google.gms.google-services` Gradle plugin applied.
 *
 * If those config files aren't in place, this function still returns
 * `'granted'` if permission was granted but `onToken` will never fire
 * because the native SDK won't bootstrap. The backend will simply have
 * no token to send to — pushes for that device are silently dropped
 * (the dispatch service marks missing tokens as `active=false`).
 */
export async function requestNativePushPermission(callbacks: {
  onToken: (token: string) => void | Promise<void>;
  onRoute: (route: string) => void;
}): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive === 'prompt') permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== 'granted') return 'denied';

    await FirebaseMessaging.removeAllListeners();
    await FirebaseMessaging.addListener('tokenReceived', ({ token }) => void callbacks.onToken(token));
    await FirebaseMessaging.addListener(
      'notificationActionPerformed',
      ({ notification }) => {
        const data = (notification.data ?? {}) as Record<string, unknown>;
        const route = data.route;
        if (typeof route === 'string' && route.startsWith('/')) callbacks.onRoute(route);
      },
    );
    await FirebaseMessaging.getToken();
    return 'granted';
  } catch {
    // Plugin missing or Firebase not configured — treat as unsupported
    // rather than crashing the app. Token registration is best-effort
    // until the FCM config files are dropped into the project.
    return 'unsupported';
  }
}

/**
 * Auto-register the push token without prompting the user. Safe to
 * call on every app launch — it only sends a token to the backend if
 * permission was already granted on a previous session. Use this from
 * a top-level effect so the token is registered proactively rather
 * than waiting for the user to tap "Enable notifications" on the Home
 * banner.
 */
export async function ensurePushTokenRegistered(callbacks: {
  onToken: (token: string) => void | Promise<void>;
  onRoute: (route: string) => void;
}): Promise<'already-registered' | 'registered' | 'not-granted' | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted') return 'not-granted';

    await FirebaseMessaging.removeAllListeners();
    await FirebaseMessaging.addListener('tokenReceived', ({ token }) => void callbacks.onToken(token));
    await FirebaseMessaging.addListener(
      'notificationActionPerformed',
      ({ notification }) => {
        const data = (notification.data ?? {}) as Record<string, unknown>;
        const route = data.route;
        if (typeof route === 'string' && route.startsWith('/')) callbacks.onRoute(route);
      },
    );
    const { token } = await FirebaseMessaging.getToken();
    if (token) {
      await callbacks.onToken(token);
      return 'already-registered';
    }
    return 'registered';
  } catch {
    return 'unsupported';
  }
}

export async function requestApproximateLocation(): Promise<{ latitude: number; longitude: number }> {
  const { Geolocation } = await import('@capacitor/geolocation');
  let permission = await Geolocation.checkPermissions();
  if (permission.location === 'prompt' || permission.coarseLocation === 'prompt') {
    permission = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
  }
  if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
    throw new Error('Location permission is off. You can keep using your city instead.');
  }
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    timeout: 12_000,
    maximumAge: 15 * 60_000,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
