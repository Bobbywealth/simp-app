# SIMP implementation matrix

This matrix is based on inspected code and executable checks, not README claims. It is updated as release-candidate work lands.

| Feature | Frontend | Backend | Database | Real-time | Tested | Status at audit |
|---|---|---|---|---|---|---|
| Signup | Connected form | JWT signup | User | N/A | Live history only | PARTIAL: display name discarded, no age/email verification |
| Login/logout | Connected | Access + hashed refresh token | RefreshToken | Socket bearer auth | Live history only | PARTIAL: no account states, replay-family handling, or device sessions |
| Email verification | Missing | Missing | Boolean only | N/A | No | MISSING |
| Forgot/reset password | Missing | Missing | Missing | N/A | No | MISSING |
| Change password | Missing | Missing | Missing | N/A | No | MISSING |
| Session management | Missing | Rotation only | Partial | N/A | No | PARTIAL |
| Marketing onboarding | Seven branded slides | N/A | N/A | N/A | Build only | COMPLETE |
| Profile onboarding | Five-step form | Profile upsert | Profile/Interest/Prompt | N/A | Build only | PARTIAL: not resumable, incomplete legal/notification flow |
| Age safety | Birthdate UI | Birthdate accepted without adult validation | Profile.birthDate | N/A | No | BROKEN |
| Profile view/edit | Implemented | Implemented | Profile | N/A | Build only | PARTIAL: no preference model, primary/reorder photo API |
| Photos | Upload/delete UI | Local Multer disk | Photo URL | N/A | No | BROKEN for Render persistence and payload validation |
| Prompts/interests | Implemented | Implemented | Prompt/Interest | N/A | Build only | COMPLETE with basic limits |
| Discovery | Swipe deck and age panel | Cursor query | Profile/Swipe/Block | N/A | Build only | PARTIAL: one-way preference matching, no persisted filters/account states |
| Pass/like/super like | Implemented | Implemented | Swipe | N/A | No | PARTIAL: duplicate handling and limits incomplete |
| Convince Me note | Implemented | Implemented | Swipe.note | N/A | Build only | COMPLETE |
| Match creation | Match modal | Unique-pair upsert | Match | N/A | No | PARTIAL: not one transaction with swipe/notifications/conversation |
| Match list/detail | Implemented | Implemented with N+1 queries | Match/Swipe | N/A | Build only | PARTIAL |
| Direct messaging | Dead alert button | Missing | Missing | Missing | No | MISSING |
| Typing/presence/read receipts | Missing | Missing | Missing | Missing | No | MISSING |
| Blocking | UI in discovery/match/settings | Basic routes | Block | No socket enforcement | No | PARTIAL |
| Reporting | Basic string reasons | Basic routes | Unstructured Report | No moderation events | No | PARTIAL |
| Admin/RBAC | Missing by design | Untracked unsafe stub, not mounted | Missing roles/audit | N/A | No | BROKEN |
| Account states | Missing | Missing | Missing | Missing | No | MISSING |
| Profile verification | Selfie capture with pose prompts (PWA + Capacitor WebView) | Multipart selfie upload to Cloudinary (`simp/verification-selfies`), moderator queue + approve/reject, side-by-side selfie vs profile photos in admin UI, self-deletion on review completion | `ProfileVerificationRequest.selfieUrl`, `selfiePublicId`, `poseSequence[]`, `livenessHints` | N/A | No (smoke-tested live after deploy) | COMPLETE — manual moderator review; vendor liveness (AWS Rekognition Face Liveness) deferred to Phase 2 |
| Live stream listing/start/end | Implemented | Implemented | LiveStream | Socket.IO | No cross-network test | PARTIAL |
| WebRTC signaling | Implemented UI/peer code | Implemented with identity/routing mismatch | N/A | Socket.IO | No | BROKEN |
| TURN | Warning/config fetch | Env-driven ICE response | N/A | WebRTC | No credentials | PARTIAL: external setup required |
| Live chat | Implemented | Persisted basic chat | LiveChatMessage | Socket.IO | No | PARTIAL: weak authorization/throttling/moderation |
| Live reactions | Animation | Broadcast only; fake HTTP endpoint | Missing | Socket.IO | No | BROKEN |
| Push notifications | Plugin present | Missing | Missing | Missing | No | MISSING |
| In-app notification center | Missing | Missing | Missing | Optional socket | No | MISSING |
| Notification preferences | Missing | Missing | Missing | N/A | No | MISSING |
| Premium | Static badges | Missing entitlement verification | Static Profile boolean | N/A | No | BROKEN |
| Daily limits | UI not authoritative | Missing | Missing | N/A | No | MISSING |
| Experiences | Marketing-only visuals | Missing | Missing | N/A | No | FEATURE-FLAG CANDIDATE |
| Home dashboard | Roadmap copy | N/A | N/A | N/A | Build only | BROKEN/outdated |
| Primary navigation | Two duplicate components, not mounted | N/A | N/A | N/A | Build only | DUPLICATED/DEAD CODE |
| Settings | Basic privacy/delete/logout | Partial | Existing records | N/A | Build only | PARTIAL |
| Data export | Download UI | Prisma field drift | Existing records | N/A | Typecheck failed | BROKEN |
| Account deletion | Confirmation UI | Hard delete + partial cloud cleanup | Cascades | Live update partial | No | PARTIAL |
| Legal versions/acceptance | Strong gate UI | Strong versioned routes | TosVersion/TosAcceptance | N/A | No | COMPLETE, migration startup policy unsafe |
| API errors | Generic display | Mixed shapes | N/A | Mixed socket errors | No | PARTIAL |
| Structured logging | N/A | Morgan/console only | N/A | Console only | No | MISSING |
| Rate limiting | N/A | Auth/swipe/upload only | N/A | Missing | No | PARTIAL |
| Pagination | Discovery only | Partial | Some indexes | N/A | No | PARTIAL |
| PWA | Manifest/update prompt | N/A | N/A | N/A | Production build passes | PARTIAL: API responses incorrectly cached, no offline UI |
| iOS | Capacitor source present | N/A | N/A | Push/WebRTC config partial | Not built yet | PARTIAL |
| Android | Capacitor source present | N/A | N/A | Push/WebRTC config partial | Not built yet | PARTIAL |
| Deep links | Config claims links | Missing web association files/handlers | N/A | Push routing missing | No | PARTIAL |
| Analytics | Missing | Missing | N/A | N/A | No | MISSING |
| Crash monitoring | Missing | Missing | N/A | N/A | No | MISSING |
| Automated tests | Missing | Missing | Seed exists | N/A | No | MISSING |
| CI/CD | Missing | Missing | Prisma checks absent | N/A | No | MISSING |
| Seed data | N/A | Dev script | 10 profiles only | N/A | Not run in audit | PARTIAL |
| README/release docs | Obsolete feature claims | Obsolete setup | Partial migration docs | Partial TURN docs | No | PARTIAL |

## Audit build baseline

- Frontend install initially failed because `@capacitor/safe-area` and `@capacitor/store` do not exist in npm.
- Frontend initially had no ESLint dependency/configuration.
- Backend Prisma validation and generation passed.
- Backend typecheck/build failed on obsolete `Swipe.targetId`, nonexistent `Match.myNote/theirNote`, incomplete untracked admin code, and incomplete untracked R2 storage code.
- Render uploads use an ephemeral local filesystem.
- Production startup swallowed migration failures and continued against potentially incompatible schemas.
- WebRTC uses user IDs where Socket.IO targets require socket IDs, so signaling cannot reliably connect peers.

