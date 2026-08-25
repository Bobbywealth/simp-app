import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.simp.client',
  appName: 'SIMP',
  appVersion: '0.2.0',
  /// Build artifact from `npm run build` (Vite outputs to ./dist).
  /// Capacitor copies this into the native project on `cap sync`.
  webDir: 'dist',

  /// Server-side config — replaces the legacy capacitor.config.json
  /// server block. These map 1:1 to native Info.plist / AndroidManifest
  /// entries; see `npx cap sync` for the auto-generated snippets.
  server: {
    androidScheme: 'https',
    iosScheme: 'simP',
    /// Allow navigation to our own API so the WebView can make XHR
    /// calls + open the Socket.IO stream without being blocked by the
    /// cleartext / CORS rules on iOS 14+ and Android 9+.
    allowNavigation: ['mysimp.app', 'www.mysimp.app', 'api.mysimp.app'],
    cleartext: false,
  },

  /// Native iOS / Android app metadata. Most of this is also written
  /// into the Xcode project (ios/App/App/Info.plist) and the Gradle
  /// manifest (android/app/src/main/AndroidManifest.xml) by `cap sync`.
  ios: {
    contentInset: 'automatic',
    /// Status bar styling matches the dark-gold PWA theme.
    backgroundColor: '#050505',
    /// Universal links for password reset emails etc.
    associatedDomains: ['applinks:mysimp.app', 'applinks:www.mysimp.app'],
  },

  android: {
    /// Adaptive icon background color (the layer behind the foreground).
    /// We use the same gold as the brand.
    backgroundColor: '#0a0a0a',
    /// WebView debugging in dev — disable in release builds by leaving
    /// it default-off (false). Flip to true during local Android Studio
    /// debugging via `npx cap run android --debug`.
    webContentsDebuggingEnabled: false,
    /// Allowlist http(s) hosts the WebView can navigate to / load assets
    /// from. Anything else triggers Android's network security config
    /// block.
    allowMixedContent: false,
  },

  plugins: {
    /// Splash screen — uses the brand gold ring, dark ink background.
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#050505',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    /// Status bar — match the PWA's black theme.
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050505',
      overlaysWebView: false,
    },
    /// Push notifications — APNs (iOS) and FCM (Android) for go-live
    /// alerts, new matches, messages. Token registration happens on
    /// first launch after the user grants permission.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    /// Preferences — secure key/value storage on top of iOS Keychain
    /// and Android EncryptedSharedPreferences. Replaces the localStorage
    /// token store so credentials survive app uninstall scenarios.
    Preferences: {
      /// No group prefix — keep keys flat for easy migration from
      /// the existing localStorage names ("simp_access", "simp_refresh").
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
      style: 'DARK',
    },
  },
};

export default config;
