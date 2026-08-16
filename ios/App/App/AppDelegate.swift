import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication,
                     didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
    }

    /// Universal links handler — called when the user opens a
    /// https://simp.app/... link and iOS routes it to our app.
    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return CAPBridge.handleContinueActivity(userActivity, restorationHandler)
    }

    /// Custom URL scheme handler (simP://) for deep links.
    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return CAPBridge.handleOpenUrl(url, options)
    }

    /// APNs token registration for push notifications.
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Forward the raw APNs token bytes to Capacitor's Push plugin.
        // The plugin converts to a hex string and emits a 'registration'
        // event that the JS side listens to.
        CAPBridge.registerDeviceToken(deviceToken)
        NotificationCenter.default.post(name: Notification.Name(CAPBridgeDidRegisterForRemoteNotificationsWithDeviceToken),
                                        object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        CAPBridge.handleRemoteNotificationRegistrationFailure(error)
    }

    /// Silent push (background fetch / content-available).
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        CAPBridge.handleRemoteNotification(userInfo)
        completionHandler(.newData)
    }
}
