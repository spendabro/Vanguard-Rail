# VanguardRail Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **Verified Authentication & Admin Isolation**:
   - All writes require `isSignedIn()` and `request.auth.token.email_verified == true`.
   - `isAdmin()` is true ONLY if the user is signed in with `email_verified == true` and either matches the bootstrapped owner email (`ajanakuayomide0@gmail.com`) or exists in `/admins/$(request.auth.uid)`.
3. **PII Protection & Query Enforcement**:
   - `/entries/{entryId}` contains contact `email` and `institution`. Reading or listing entries is restricted to `isAdmin() || (isSignedIn() && resource.data.authorUid == request.auth.uid)`.
   - `/outbound_emails/{emailId}` contains `recipientEmail` and message bodies. Reading, listing, and creating outbound emails is strictly restricted to `isAdmin()` where `sentByUid == request.auth.uid` and `exists(/databases/$(database)/documents/entries/$(incoming().relatedEntryId))`.
4. **Immutable & Server-Timestamped Fields**:
   - `createdAt` must equal `request.time` on `create` and remain unchanged on `update`.
   - `updatedAt` must equal `request.time` on `create` and `update`.
   - `authorUid` on `/entries/{entryId}` must equal `request.auth.uid` on `create` and remain immutable on `update`.
5. **Terminal State Locking**:
   - Once an `AdminEntry` reaches `status == 'archived'`, non-admins cannot update it; only `isAdmin()` can modify or transition status.

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Entry Create)**: Authenticated user sets `authorUid: "other_user_uid"` on `/entries/entry_1`. -> `PERMISSION_DENIED`
2. **Payload 2 (Shadow Field Injection on Entry Create)**: Payload includes extra ghost field `"isSuperAdmin": true`. -> `PERMISSION_DENIED`
3. **Payload 3 (Unverified Email Admin Spoof)**: User token has `email: "ajanakuayomide0@gmail.com"` but `email_verified: false`. -> `PERMISSION_DENIED`
4. **Payload 4 (PII Blanket Read on Entries)**: Authenticated non-admin attempts `get` on `/entries/entry_other` where `authorUid != request.auth.uid`. -> `PERMISSION_DENIED`
5. **Payload 5 (Unscoped List Scraping on Entries)**: Non-admin attempts unfiltered `list` on `/entries` across all users. -> `PERMISSION_DENIED`
6. **Payload 6 (Client Timestamp Forgery)**: Payload sets `createdAt` to a past/future timestamp instead of `request.time`. -> `PERMISSION_DENIED`
7. **Payload 7 (ID Poisoning Attack)**: Document ID exceeds 128 characters or contains illegal characters. -> `PERMISSION_DENIED`
8. **Payload 8 (Denial-of-Wallet String Overflow)**: `notes` field exceeds `maxLength: 500` (e.g., 10,000 chars). -> `PERMISSION_DENIED`
9. **Payload 9 (Orphaned Outbound Email Create)**: Admin creates `/outbound_emails/em_1` referencing a non-existent `relatedEntryId`. -> `PERMISSION_DENIED`
10. **Payload 10 (Non-Admin Outbound Email Dispatch)**: Non-admin user attempts to create `/outbound_emails/em_1`. -> `PERMISSION_DENIED`
11. **Payload 11 (Immortal Field Mutation on Update)**: Updating `/entries/entry_1` while changing `authorUid` or `createdAt`. -> `PERMISSION_DENIED`
12. **Payload 12 (Self-Assigned Admin Escalation)**: Non-admin user attempts to create `/admins/{uid}` to grant themselves admin privileges. -> `PERMISSION_DENIED`
