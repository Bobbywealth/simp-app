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

export async function requestNativePushPermission(callbacks: {
  onToken: (token: string) => void | Promise<void>;
  onRoute: (route: string) => void;
}): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return 'denied';

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener('registration', ({ value }) => void callbacks.onToken(value));
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const route = notification.data?.route;
    if (typeof route === 'string' && route.startsWith('/')) callbacks.onRoute(route);
  });
  await PushNotifications.register();
  return 'granted';
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
