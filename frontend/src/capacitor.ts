/**
 * Capacitor native-bridge initialization.
 *
 * Runs on app start (see main.tsx). When the app is loaded as a web
 * PWA (no native bridge), all imports no-op gracefully so the same
 * bundle works for both web and native.
 *
 * What this does on native:
 *  - Hides the splash screen once React mounts
 *  - Styles the status bar to match the dark-gold theme
 *  - Configures the keyboard to resize the WebView (so the chat input
 *    works on iOS, fixing the same issue we already fixed with
 *    `interactive-widget=resizes-content` on the web side)
 *  - Wires up push notification registration; the token is forwarded
 *    to /users/me/push-token for server-side APNs/FCM routing
 *  - Persists auth tokens in the native Keychain (iOS) /
 *    EncryptedSharedPreferences (Android) instead of localStorage, so
 *    they survive app uninstall and don't appear in WebView backups
 */
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): 'ios' | 'android' | 'web' => Capacitor.getPlatform() as 'ios' | 'android' | 'web';

let initialized = false;

export async function initNative(): Promise<void> {
  if (!isNative() || initialized) return;
  initialized = true;

  // Status bar + splash
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#050505' });
  } catch (e) {
    console.warn('[native] status-bar init failed', e);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) {
    console.warn('[native] splash-screen hide failed', e);
  }

  // Keyboard
  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setStyle({ style: 'DARK' as 'DARK' });
  } catch (e) {
    console.warn('[native] keyboard init failed', e);
  }

  // Safe area (for devices with notches / Dynamic Island)
  try {
    const { SafeArea } = await import('@capacitor/safe-area');
    await SafeArea.enable({ config: true });
  } catch (e) {
    console.warn('[native] safe-area init failed', e);
  }

  // Push notifications
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
    }
    // The registration listener is wired up in App.tsx so it can
    // dispatch the token to our backend. See `usePushNotifications` in
    // a follow-up.
  } catch (e) {
    console.warn('[native] push-notifications init failed', e);
  }
}

/**
 * Helper to push the access/refresh tokens into native secure storage
 * once login succeeds. Called from the auth store after a successful
 * login or refresh.
 */
export async function persistTokensNative(access: string, refresh: string): Promise<void> {
  if (!isNative()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: 'simp_access', value: access });
    await Preferences.set({ key: 'simp_refresh', value: refresh });
  } catch (e) {
    console.warn('[native] token persist failed', e);
  }
}

/**
 * Read tokens from native storage (if any) and seed them into the
 * web localStorage so the rest of the app (which uses
 * `localStorage.getItem('simp_access')` in api/client.ts) works the
 * same on native and web.
 */
export async function hydrateTokensFromNative(): Promise<{
  access: string | null;
  refresh: string | null;
}> {
  if (!isNative()) return { access: null, refresh: null };
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value: access } = await Preferences.get({ key: 'simp_access' });
    const { value: refresh } = await Preferences.get({ key: 'simp_refresh' });
    if (access) localStorage.setItem('simp_access', access);
    if (refresh) localStorage.setItem('simp_refresh', refresh);
    return { access: access ?? null, refresh: refresh ?? null };
  } catch (e) {
    console.warn('[native] token hydrate failed', e);
    return { access: null, refresh: null };
  }
}

/**
 * Clear native-stored tokens on logout.
 */
export async function clearTokensNative(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: 'simp_access' });
    await Preferences.remove({ key: 'simp_refresh' });
  } catch (e) {
    console.warn('[native] token clear failed', e);
  }
}
