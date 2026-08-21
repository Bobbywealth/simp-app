import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_NAME = 'SIMP';
const APP_SHORT = 'SIMP';
const APP_DESCRIPTION = 'SIMP — Successful · Intentional · Male · Providers. Real connections and experiences.';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'inline',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'icons/apple-touch-icon-180.png',
        'icons/apple-touch-icon-167.png',
        'icons/apple-touch-icon-152.png',
        'icons/apple-touch-icon-120.png',
        'icons/favicon.svg',
        'icons/simp-emblem.svg',
        'icons/splash-1170x2532.png',
        'icons/splash-1290x2796.png',
        'icons/splash-1179x2556.png',
        'icons/splash-1125x2436.png',
        'screenshots/home-mobile.png',
        'screenshots/onboarding-mobile.png',
        'screenshots/discover-mobile.png',
      ],
      manifest: {
        name: APP_NAME,
        short_name: APP_SHORT,
        description: APP_DESCRIPTION,
        id: '/?source=pwa',
        categories: ['social', 'lifestyle', 'dating'],
        dir: 'ltr',
        lang: 'en-US',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        display_override: [
          'standalone',
          'window-controls-overlay',
          'tabbed',
        ],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?utm_source=pwa',
        prefer_related_applications: false,
        related_applications: [
          {
            platform: 'itunes',
            url: 'https://apps.apple.com/app/simp/id000000000',
            id: 'app.simp.client',
          },
          {
            platform: 'play',
            url: 'https://play.google.com/store/apps/details?id=app.simp.client',
            id: 'app.simp.client',
          },
        ],
        iarc_rating_id: 'fb48fbb8-31a6-4d8b-9f6e-7e8e3f3f3f3f',
        scope_extensions: [
          { origin: 'https://simp.app' },
          { origin: 'https://api.simp.app' },
        ],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-1024.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/onboarding-mobile.png',
            sizes: '1170x2532',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'SIMP onboarding — Real People. Real Connections.',
          },
          {
            src: '/screenshots/home-mobile.png',
            sizes: '1290x2796',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'SIMP home — curated matches and live moments.',
          },
          {
            src: '/screenshots/discover-mobile.png',
            sizes: '1179x2556',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'SIMP discover — swipe through verified members.',
          },
          {
            src: '/screenshots/desktop-wide.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'SIMP desktop — full experience on the web.',
          },
        ],
        shortcuts: [
          {
            name: 'Discover matches',
            short_name: 'Discover',
            description: 'Swipe through curated matches nearby.',
            url: '/discover',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'My messages',
            short_name: 'Messages',
            description: 'Open your latest conversations.',
            url: '/messages',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'My matches',
            short_name: 'Matches',
            description: 'See who you matched with.',
            url: '/matches',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Live now',
            short_name: 'Live',
            description: 'Tune into a live stream.',
            url: '/live',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        launch_handler: {
          client_mode: 'auto',
        },
        protocol_handlers: [
          {
            protocol: 'mailto',
            url: '/support?email=%s',
          },
          {
            protocol: 'web+simp',
            url: '/open?path=%s',
          },
        ],
        share_target: {
          action: '/share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'media',
                accept: ['image/png', 'image/jpeg', 'image/webp'],
              },
            ],
          },
        },
        // Newer manifest fields — vite-plugin-pwa types don't yet include these,
        // so cast the rest as `any`. They pass through into the generated
        // manifest.webmanifest as plain JSON.
        widgets: [
          {
            name: 'SIMP Matches',
            short_name: 'Matches',
            description: 'Your latest matches at a glance.',
            tag: 'matches',
            template: '/widgets/matches.json',
            screenshots: [
              {
                src: '/screenshots/widgets-matches.png',
                sizes: '600x400',
                type: 'image/png',
                label: 'SIMP matches widget',
              },
            ],
          },
          {
            name: 'SIMP Profile',
            short_name: 'Profile',
            description: 'Quick view of your SIMP profile.',
            tag: 'profile',
            template: '/widgets/profile.json',
            screenshots: [
              {
                src: '/screenshots/widgets-profile.png',
                sizes: '600x400',
                type: 'image/png',
                label: 'SIMP profile widget',
              },
            ],
          },
        ],
        edge_side_panel: {
          preferred_width: 480,
        },
        window_controls_overlay: {
          theme_color: '#000000',
          background_color: '#000000',
        },
        tabbed: {
          default_icon_path: '/icons/icon-192.png',
        },
        note_taking: {
          new_note_url: '/notes/new',
        },
        file_handlers: [
          {
            action: '/open-file',
            accept: {
              'image/png': ['.png'],
              'image/jpeg': ['.jpg', '.jpeg'],
              'image/webp': ['.webp'],
            },
          },
        ],
      } as any,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Native-only modules are loaded dynamically at runtime when the
    // iOS / Android shells are installed. Tell Rollup not to try to
    // resolve them at build time so the web bundle doesn't fail.
    rollupOptions: {
      external: [
        '@capacitor/storekit-bridge',
        'cordova-plugin-purchase',
      ],
    },
  },
});
