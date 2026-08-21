# App Store Privacy Nutrition Labels — Data Inventory

This is the source-of-truth document for filling out App Store Connect's "App Privacy" questionnaire. Every item below should be entered verbatim into the questionnaire for the SIMP iOS app.

For each data type, App Store asks three questions:
1. **Does your app collect this data?** (Yes / No)
2. **Is it linked to the user's identity?** (Linked / Not linked)
3. **Is it used for tracking?** (Yes / No — "tracking" means combining with data from other companies' apps for ad targeting)

We **do not track** for advertising. We **do** link everything below to user identity (the SIMP user id) for the purpose of providing the service.

## Collected

| Data type | Linked? | Tracking? | Purpose (App Store reason) |
|---|---|---|---|
| **Contact Info → Email Address** | Linked | No | App Functionality (account creation, login) |
| **Contact Info → Name** | Linked | No | App Functionality (display name) |
| **Financial Info → Purchase History** | Linked | No | App Functionality (entitlement to SIMP+ / SIMP Elite) |
| **Health & Fitness → None** | — | — | — |
| **Location → Coarse Location** | Linked | No | App Functionality (approximate distance to other members) |
| **Location → Precise Location** | Not collected | — | We only derive coarse location from IP. We do not request GPS. |
| **Sensitive Info → None** | — | — | — |
| **Contacts → None** | — | — | — |
| **User Content → Photos or Videos** | Linked | No | App Functionality (profile photos, verification selfies) |
| **User Content → Audio Data** | Not collected | — | — |
| **User Content → Gameplay Content** | Not collected | — | — |
| **User Content → Customer Support** | Linked | No | App Functionality (responses to in-app support tickets) |
| **User Content → Other User Content** | Linked | No | App Functionality (profile bio, prompts, messages) |
| **Browsing History → None** | — | — | — |
| **Search History → None** | — | — | — |
| **Identifiers → User ID** | Linked | No | App Functionality (account id) |
| **Identifiers → Device ID** | Linked | No | App Functionality (push tokens, session management) |
| **Usage Data → Product Interaction** | Linked | No | Analytics (aggregated, in-house only — first-party) |
| **Usage Data → Advertising Data** | Not collected | — | — |
| **Usage Data → Other Usage Data** | — | — | — |
| **Diagnostics → Crash Data** | Linked | No | App Functionality (stability monitoring) |
| **Diagnostics → Performance Data** | Linked | No | App Functionality (latency tracking) |
| **Diagnostics → Other Diagnostic Data** | — | — | — |
| **Purchases → Purchase History** | Linked | No | App Functionality (subscription status) |
| **Financial Info → Payment Info** | Not collected | — | We never see payment card data. Apple handles it via StoreKit. |
| **Financial Info → Credit Info** | Not collected | — | — |
| **Financial Info → Other Financial Data** | — | — | — |
| **Sensitive Info → Racial or Ethnic Data** | Not collected | — | — |
| **Sensitive Info → Sexual Orientation** | Not collected | — | — |
| **Sensitive Info → Disability** | Not collected | — | — |
| **Sensitive Info → Religious or Philosophical Beliefs** | Not collected | — | — |
| **Sensitive Info → Trade Union Membership** | Not collected | — | — |
| **Sensitive Info → Political Affiliation** | Not collected | — | — |
| **Sensitive Info → Genetic Data** | Not collected | — | — |
| **Sensitive Info → Biometric Data** | Not collected | — | Verification selfies are processed, then permanently deleted. They are not "biometric data" under Apple's definition because we don't use them for persistent identification. |
| **Sensitive Info → Health Data** | Not collected | — | — |

## Data NOT collected (explicit "No")

- Precise Location
- Contacts
- Calendars
- Reminders
- Bluetooth
- Voice / Audio recordings
- Photos outside of profile + verification
- Browsing history
- Search history
- Any third-party SDK tracking
- IDFA — App Tracking Transparency prompt not shown (we don't track)
- Cookies for cross-site advertising
- Any data sold to data brokers

## How SIMP uses data (purpose categories Apple requires)

App Store Connect asks for purpose per data type. We use data only for **App Functionality**, which means: data is required for the app to work as the user expects. We do not use data for **Third-Party Advertising** or **Developer's Advertising/Marketing**.

| App Functionality purpose | What it means for SIMP |
|---|---|
| Account management | Email, password hash, display name, birthdate |
| Authentication | Hashed passwords, JWT tokens, Apple identity tokens |
| Service personalization | Age gate, gender, lookingFor, bio, photos, interests |
| Communications | Direct messages, push notifications, email verification |
| Purchases | Apple StoreKit receipt validation for SIMP+ / Elite |
| Customer support | In-app ticket contents, account-action audit logs |

## App Privacy questionnaire summary

When filling out the questionnaire on App Store Connect, the final summary should read approximately:

> SIMP collects the following data, all linked to your user ID and used only to make the app work:
>
> • Contact Info: Email, Name
> • Financial Info: Purchase History
> • Location: Coarse Location only (no GPS)
> • Identifiers: User ID, Device ID
> • Usage Data: Product Interaction
> • Diagnostics: Crash Data, Performance Data
> • User Content: Photos/Videos, Customer Support, Other Content (bio, prompts, messages)
> • Purchases: Purchase History
>
> We never collect: Contacts, Precise Location, Browsing/ Search History, Sensitive Info, payment card numbers, advertising identifiers, or any third-party tracking data.
>
> We never use your data for advertising, profiling, or sale to data brokers.

## How to fill this out in App Store Connect

1. Open App Store Connect → My Apps → SIMP → App Privacy
2. Click "Get Started"
3. For each data type App Store lists, answer Yes/No, then if Yes, choose whether it's Linked / Not Linked / Used for Tracking
4. For each Yes item, choose at least one purpose from: App Functionality / Analytics / Product Personalization / Third-Party Advertising / Developer's Advertising / Other
5. Final summary is auto-generated from your answers — verify it matches this document before submitting

## Re-submission triggers

If SIMP's data practices change, update this document and re-submit the App Privacy section in App Store Connect. Apple reviews privacy labels on every submission. Required to update when:

- New data types are collected
- New purpose categories apply
- Data starts being used for tracking
- Third-party SDKs change data collection
- Account deletion flow changes
- Privacy policy URL changes
