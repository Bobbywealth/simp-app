# App Store Submission Checklist: Dating/Social App (2024-2025)

## APPLE APP STORE

### 1. Safety Requirements (Section 1)

#### 1.1 Objectionable Content
- [ ] No explicit sexual content or "hookup" app descriptions (Guideline 1.1.4)
- [ ] No pornographic material
- [ ] No content facilitating prostitution or human trafficking/exploitation
- [ ] No defamatory, discriminatory, or mean-spirited content
- [ ] No content targeting specific groups with humiliation/intimidation

#### 1.2 User-Generated Content (CRITICAL for dating apps)
Dating apps are considered social apps with user-generated content and MUST include:
- [ ] **Content filtering mechanism** - filter objectionable material from being posted
- [ ] **Reporting mechanism** - ability to report offensive content
- [ ] **Timely response** to reported concerns
- [ ] **Blocking capability** - ability to block abusive users
- [ ] **Published contact information** - visible way to reach you
- [ ] **Terms of Service / Community Standards** - published and enforceable

**Dating apps specifically may NOT include:**
- Content primarily for pornographic purposes
- Chatroulette-style random/anonymous chat experiences
- "Hot-or-not" voting/objectification of real people
- Physical threats or bullying functionality

#### 1.3 Kids Category
- [ ] If targeting children, must comply with Kids Category requirements
- [ ] No links out of app, purchasing opportunities without parental gate
- [ ] No third-party analytics or advertising for kids
- [ ] No IDFA collection from children
- [ ] No personally identifiable information sent to third parties

#### 1.4 Physical Harm
- [ ] No features encouraging illegal drug use
- [ ] No content facilitating sale of controlled substances

#### 1.5 Developer Information
- [ ] Valid contact information in app and Support URL
- [ ] Easy way for users to contact you

#### 1.6 Data Security
- [ ] Appropriate security measures for user data
- [ ] Prevent unauthorized use, disclosure, or access

### 2. Performance Requirements (Section 2)

#### 2.1 App Completeness
- [ ] Final version submitted (not beta/placeholder)
- [ ] All metadata complete and accurate
- [ ] Demo account credentials provided (or built-in demo mode)
- [ ] Backend services live and accessible during review
- [ ] Detailed explanations in App Review notes for non-obvious features

#### 2.3 Accurate Metadata
- [ ] Age rating questions answered honestly (affects parental controls)
- [ ] Unique app name (30 char limit)
- [ ] Accurate keywords - no trademark stuffing
- [ ] App name, subtitles, screenshots, previews not include prices/terms
- [ ] Metadata appropriate for all audiences (4+ rating even if app is higher)
- [ ] Screenshots show app in use, not just title art
- [ ] Screenshots may include text/image overlays for demonstration

#### 2.3.4 Previews (Videos)
- [ ] Only use video screen captures of the app itself
- [ ] May add narration, textual overlays to explain
- [ ] Stickers/iMessage extensions may show Messages app experience

### 3. Business Requirements (Section 3)

#### 3.1 Payments
- [ ] Use In-App Purchase for unlocking features
- [ ] No alternative purchase mechanisms (license keys, QR codes, crypto, etc.)
- [ ] Gift cards/certificates must use IAP for digital goods
- [ ] Loot boxes must disclose odds

#### 3.1.2 Subscriptions
- [ ] Subscription period at least 7 days
- [ ] Available across all user devices
- [ ] Auto-renewable subscriptions must provide ongoing value
- [ ] Clearly disclose duration, content/services that end, downstream charges

### 4. Design Requirements (Section 4)

#### 4.1 Minimum Functionality
- [ ] App provides meaningful functionality
- [ ] No "placeholder" or "web wrapper" apps without added functionality

#### 4.2 App Store Optimization
- [ ] Appropriate category selection (Social Networking or Lifestyle for dating)
- [ ] Proper age rating (typically 17+ for dating apps due to user content)

### 5. Legal Requirements (Section 5)

#### 5.1 Privacy
- [ ] **Privacy Policy URL** in App Store Connect
- [ ] Privacy policy accessible within app
- [ ] **Apple Sign In** compliance if offering social login:
  - Only use Sign in with Apple for user authentication
  - Cannot use it exclusively if other social login options offered
  - Must offer Sign in with Apple to users in EU/EEA (DMA compliance)
  - Cannot track users across apps/websites for advertising without ATT permission

#### 5.1.1 Data Collection & Privacy Nutrition Labels
In App Store Connect, accurately declare:
- [ ] Data types collected (contact info, health/fitness, location, etc.)
- [ ] Whether data is linked to user identity
- [ ] Purpose of collection (app functionality, analytics, advertising)
- [ ] Third-party SDKs data practices included

#### 5.1.2 App Tracking Transparency (ATT)
If you track users across apps/websites for advertising:
- [ ] Implement `ATTrackingManager` request permission
- [ ] Display system permission prompt before tracking
- [ ] Respect user's choice (do not track if denied)
- [ ] Do not track users under 13 (or use Limited Ad Tracking for ages 13-17)

### 6. Required Legal Documents

#### Privacy Policy Must Include:
- [ ] What data is collected (all user data types)
- [ ] How data is used
- [ ] Who data is shared with (third parties, SDKs)
- [ ] Data retention policy
- [ ] User rights (deletion, access, correction)
- [ ] Contact information
- [ ] GDPR-compliant clauses for EU users (lawful basis, data subject rights)

#### Terms of Service Must Include:
- [ ] User eligibility (minimum age requirement - typically 18+)
- [ ] Prohibited content/behaviors
- [ ] Content moderation policies
- [ ] User rights and responsibilities
- [ ] Limitation of liability
- [ ] Dispute resolution

### 7. Age Verification & Parental Controls

#### For Dating Apps (typically 17+ rating):
- [ ] Minimum age enforcement (18+)
- [ ] Age verification mechanism (birthdate alone is insufficient per some guidelines)
- [ ] Parental controls awareness - users should know if device has Screen Time restrictions
- [ ] Content rating honestly declared (dating apps typically require 17+ rating)

---

## GOOGLE PLAY STORE

### 1. Restricted Content

#### Dating Apps & Relationships
- [ ] App must not be primarily for dating if targeting children
- [ ] No providing dating services for minors
- [ ] No sexual or marital advice apps targeting children
- [ ] Social apps where main focus is chatting with unknown people may NOT target children

### 2. User-Generated Content / Social Features

#### If app includes social features:
- [ ] Accurate disclosure in content rating questionnaire
- [ ] In-app reminder about online safety before allowing media exchange
- [ ] Warning about real-world risks of online interaction
- [ ] Adult action required before enabling personal information exchange
- [ ] Method for adults to manage social features for minors

### 3. Families Policy (if any users under 18)

**If targeting children or mixed audience:**
- [ ] Only use Google Play Families Self-Certified Ads SDKs
- [ ] NO interest-based advertising or remarketing to children
- [ ] No personalized ads to children
- [ ] Ads must be age-appropriate for children
- [ ] No interstitial ads on app launch
- [ ] No disruptive ad formats (full screen, uncloseable after 5s)
- [ ] No collection of AAID, SIM Serial, IMEI from children
- [ ] No precise location collection from children-only apps
- [ ] Privacy policy must accurately reflect data collection
- [ ] Target audience declared accurately in Play Console

#### Mixed Audience (includes children):
- [ ] **Neutral age screen** required
- [ ] Adults must verify before accessing adult features
- [ ] SDKs must be approved for child-directed use

### 4. Data Safety Section

**Required for ALL apps:**
- [ ] Complete Data safety form in Play Console
- [ ] Disclosure of ALL data types collected
- [ ] Whether data is collected/shared
- [ ] Purpose of collection/use
- [ ] Third-party sharing disclosure (including SDKs)
- [ ] Encryption in transit declaration
- [ ] User account deletion mechanism offered
- [ ] Privacy policy URL in Play Console

### 5. Privacy & Data Requirements

#### User Data Policy:
- [ ] Be transparent about data handling
- [ ] Limit data collection to app functionality
- [ ] Secure data handling (HTTPS, encryption)
- [ ] Runtime permissions before data access
- [ ] **DO NOT SELL personal/sensitive user data**
- [ ] Account deletion functionality (in-app AND external web resource)
- [ ] Delete ALL user data upon account deletion request
- [ ] Account freezing is NOT acceptable substitute for deletion

#### Prominent Disclosure Requirements:
- [ ] In-app disclosure BEFORE permission requests
- [ ] Describe data being accessed/collected
- [ ] Explain how data will be used/shared
- [ ] Cannot be only in privacy policy or terms of service
- [ ] Must use affirmative user action for consent
- [ ] No auto-dismiss popups for consent

#### For EU Users (GDPR):
- [ ] Lawful basis for processing (consent or legitimate interest)
- [ ] Data subject rights (access, rectification, erasure, portability)
- [ ] Data protection contact or mechanism
- [ ] Comply with EU-U.S. Data Privacy Framework if applicable

### 6. Deceptive Behavior Policy

- [ ] App description, title, screenshots must accurately reflect functionality
- [ ] NO misrepresenting app as something it's not
- [ ] NO claiming impossible features
- [ ] NO impersonating other apps/brands/government entities
- [ ] NO "official" in title without proper rights
- [ ] NO different functionality based on geography/device without disclosure

### 7. Content Rating (IARC)

- [ ] Complete IARC content rating questionnaire
- [ ] Answer questions honestly about:
  - Content types (violence, sexual content, profanity, etc.)
  - User-generated content features
  - Social networking features
  - Dating features (will increase rating)
- [ ] Dating apps typically receive "High Maturity" rating

### 8. Play Store Listing Requirements

#### App Icon:
- [ ] 512x512px PNG with alpha
- [ ] Max 1024KB
- [ ] No badges/text about ranking/price/categories

#### Feature Graphic:
- [ ] 1024x500px
- [ ] JPEG or 24-bit PNG (no alpha)
- [ ] Convey app experience
- [ ] Key elements toward center (avoid cutoff zones)
- [ ] No ranking/price/performance claims

#### Screenshots:
- [ ] Minimum 2 screenshots required
- [ ] 320px min dimension, 3840px max
- [ ] JPEG or 24-bit PNG (no alpha)
- [ ] At least 4 screenshots with 1080px+ for recommendation eligibility
- [ ] 16:9 landscape or 9:16 portrait
- [ ] Show actual in-app experience
- [ ] No device frames, service provider notifications

#### Short Description:
- [ ] 80 character limit
- [ ] Summarize core value proposition
- [ ] No price/ranking/CTA language
- [ ] No promotional claims ("Best", "Top", "Free", etc.)

#### Preview Video:
- [ ] YouTube URL (not playlist/channel)
- [ ] Public or unlisted (not private)
- [ ] Ads disabled
- [ ] Not age-restricted
- [ ] Embeddable
- [ ] Shows actual app experience

---

## BOTH STORES: Common Requirements

### Legal Documents
| Document | Apple | Google |
|----------|-------|--------|
| Privacy Policy URL | Required in App Store Connect | Required in Play Console + in-app |
| Terms of Service | In-app | In-app |
| Cookie Consent (GDPR) | If using non-essential cookies | If using non-essential cookies |

### Screenshot Specifications Comparison
| Spec | Apple | Google |
|------|-------|--------|
| Format | PNG (recommended) | JPEG or 24-bit PNG |
| Min dimension | 640px (iPhone) | 320px |
| Max dimension | 3840px | 3840px |
| Aspect ratio | 16:9 or 3:4 recommended | 16:9 or 9:16 |
| Min screenshots | 1 (6 recommended) | 2 |
| Max screenshots | 10 | 8 per device type |
| Text overlays | Allowed | Allowed (taglines ≤20% of image) |

### Video/App Preview Specifications
| Spec | Apple | Google |
|------|-------|--------|
| Max length | 30 seconds (App Preview) | No max, first 30s autoplays |
| Format | M4V, MP4, MOV | YouTube URL |
| Content | App screen capture only | App screen capture |
| Narration | Allowed | Allowed |
| Required | No (recommended) | No (recommended for games) |

### Review Times
| Store | Typical | Notes |
|-------|---------|-------|
| Apple | 24-48 hours | May take longer for first app or complex features |
| Google | 1-7 days | Expanded reviews may take longer |

### Common Rejection Reasons
1. **Apple:**
   - Missing demo account credentials
   - Incomplete privacy policy
   - Content moderation deficiencies (UGC apps)
   - Age rating inconsistency
   - Screenshot showing non-app content

2. **Google:**
   - Incomplete Data Safety form
   - Privacy policy missing required elements
   - Ads policy violations
   - Misleading descriptions/screenshots
   - Account deletion not functional

### Key Differences for Dating Apps
| Aspect | Apple | Google |
|--------|-------|--------|
| UGC Requirements | 1.2 - detailed moderation requirements |分散在多个政策中 |
| Age Verification | App Store rating (17+) + ATT | Target audience declaration |
| Ads in Apps | ATT prompt required | Families SDK for children |
| Data Deletion | User can request | Must provide in-app + external mechanism |

---

## PRE-SUBMISSION CHECKLIST

### App Functionality
- [ ] Tested for crashes/bugs
- [ ] All features fully functional
- [ ] Backend services accessible during review
- [ ] Demo account active (or demo mode implemented)

### Store Listing
- [ ] App name unique and ≤30 chars (Apple) / ≤50 chars (Google)
- [ ] Description written and localized
- [ ] Screenshots uploaded (correct dimensions)
- [ ] Feature graphic created
- [ ] Preview video created and uploaded (optional but recommended)
- [ ] Category selected appropriately
- [ ] Age rating declared honestly

### Legal
- [ ] Privacy policy live at accessible URL
- [ ] Privacy policy covers all data practices
- [ ] Terms of service published in-app
- [ ] Cookie consent mechanism (if needed for GDPR)
- [ ] GDPR-compliant user rights implemented

### Compliance
- [ ] Content moderation system in place
- [ ] Reporting mechanism functional
- [ ] Blocking functionality working
- [ ] Contact information visible
- [ ] ATT implemented (if tracking for ads)
- [ ] Data Safety form completed (Google)
- [ ] Account deletion mechanism (Google - required)

### ATTENTION: Dating App Specifics
- [ ] Age verification/age gate implemented
- [ ] No random/anonymous chat features (these violate guidelines)
- [ ] Clear community standards/ToS
- [ ] No "hookup" or explicit language in marketing
- [ ] 17+ rating (Apple) / High Maturity (Google)
- [ ] Safety reminders before UGC exchange
