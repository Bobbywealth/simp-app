package app.simp.client;

import android.app.Application;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginRequest;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.Plugin;
import java.util.ArrayList;

/**
 * MainApplication — Capacitor's Application class. Auto-loads all
 * plugins declared in package.json and registers them with the bridge.
 *
 * To add a custom Capacitor plugin (e.g. for IAP or Sign in with Apple),
 * declare it here or in MainActivity and Capacitor will pick it up.
 */
public class MainApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        // BridgeActivity handles plugin registration automatically when
        // the manifest declares the package via the <application> tag.
    }
}
