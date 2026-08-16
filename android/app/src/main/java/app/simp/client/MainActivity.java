package app.simp.client;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity is the entry point Capacitor wires the WebView into.
 * Everything else (plugins, splash, status bar, push notifications) is
 * handled by the parent BridgeActivity based on capacitor.config.ts +
 * AndroidManifest.xml — no custom code is needed here for the happy
 * path.
 *
 * If you need to:
 *  - Intercept deep links before they reach the WebView: override
 *    onCreate(Bundle) and call super.onCreate after handling.
 *  - Handle screen-orientation locks: add `android:screenOrientation`
 *    to the <activity> tag in AndroidManifest.xml.
 *  - Disable hardware back button WebView navigation: override
 *    onBackPressed().
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register additional plugins here. Capacitor auto-discovers any
        // plugin class annotated with @CapacitorPlugin that's on the
        // classpath, so explicit registration is rarely needed.
        //
        // Example for a custom plugin:
        // registerPlugin(SimpPushNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
