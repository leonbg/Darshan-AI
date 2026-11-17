# Firestore Security Architecture & Payload-First TDD Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path outside `/derashot_archive/{derashaId}` and `/comparative_studies/{studyId}` is unconditionally denied (`allow read, write: if false;`).
2. **Strict Tenant Ownership & ID Namespace Binding**:
   - Every document in `derashot_archive` and `comparative_studies` must have `ownerId == request.auth.uid` and a valid document ID (`^[a-zA-Z0-9_\-]{1,128}$`) prefixed with `${request.auth.uid}_`.
   - No user can read (`get`/`list`), create, update, or delete another user's records, nor squat on another user's `${uid}_*` document ID slot.
3. **Verified Email Requirement on Writes**: All mutations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
4. **Strict Key & Type Schema Blueprint**:
   - `DerashaArchiveRecord` requires all 12 keys (`hasAll` + `hasOnly`), bounded UTF-8 strings (`size() >= 1 && size() <= MAX`), integer `sequenceNumber` in `[1..100000]`, and server timestamps.
   - `ComparativeDerashaStudy` requires all 11 keys (`hasAll` + `hasOnly`), enum `relationType` in `['RELACION', 'CONTRADICCION', 'COMPLEMENTO', 'INTEGRAL']`, bounded strings, and server timestamps.
5. **Temporal & Immortal Field Integrity**:
   - On `create`: `createdAt == request.time && updatedAt == request.time`.
   - On `update`: `ownerId`, `sequenceNumber` (or `relationType`/`comparedLabel`), and `createdAt` are immutable (`incoming().field == existing().field`), `updatedAt == request.time`, and only allowlisted mutable fields may appear in `incoming().diff(existing()).affectedKeys()`.
6. **Secure List Queries**: `allow list` never uses blanket `isSignedIn()` alone; it enforces `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return `PERMISSION_DENIED`)
1. **Identity Spoofing on Create**: Authenticated user `uid_A` creates `derashot_archive/uid_A_derasha_1` with `ownerId: "uid_B"`. -> Rejected by `data.ownerId == request.auth.uid`.
2. **ID Squatting Attack**: Authenticated user `uid_A` creates `derashot_archive/uid_B_derasha_1` with `ownerId: "uid_A"`. -> Rejected by `isOwnerPrefixedId(derashaId)`.
3. **Unverified Email Write**: User with `email_verified: false` attempts `create`, `update`, or `delete`. -> Rejected by `isVerifiedUser()`.
4. **Shadow / Ghost Field Injection**: Payload includes all valid fields plus `"isAdmin": true` or `"role": "admin"`. -> Rejected by `data.keys().hasOnly([...])`.
5. **Missing Required Field**: Payload omits `sourcesSummary` or `createdAt`. -> Rejected by `data.keys().hasAll([...])`.
6. **Client-Spoofed Timestamp on Create**: Payload supplies `Timestamp.fromMillis(1000000)` instead of `serverTimestamp()`. -> Rejected by `incoming().createdAt == request.time`.
7. **Immortal `createdAt` Tampering on Update**: `setDoc` or `updateDoc` attempts to overwrite `createdAt` with a new timestamp. -> Rejected by `incoming().createdAt == existing().createdAt` and `affectedKeys().hasOnly(...)`.
8. **Ownership Transfer on Update**: Owner attempts `updateDoc` changing `ownerId` to another UID. -> Rejected by `isValidDerashaArchiveRecord(incoming())`, `incoming().ownerId == existing().ownerId`, and `affectedKeys().hasOnly(...)`.
9. **Resource / Wallet Poisoning (1MB String)**: Payload sends a 100KB `title` or 500KB `essaySummary`. -> Rejected by `.size() <= 300` / `.size() <= 30000`.
10. **Path Variable Poisoning**: Document ID contains 200 characters or special characters (`../`, spaces). -> Rejected by `isValidId(id)`.
11. **Value Type Poisoning on Update**: Updating `essaySummary` to `true` (boolean) or `""` (empty string). -> Rejected because `isValidDerashaArchiveRecord(incoming())` wraps the entire `allow update` block.
12. **Unfiltered Collection Scraping (`list`)**: Authenticated user runs `getDocs(collection(db, 'derashot_archive'))` without `where('ownerId', '==', uid)`. -> Rejected by `allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid`.

## 3. Red Team Audit Conflict Report
- **Collection `/derashot_archive/{derashaId}`**:
  - Identity Spoofing: Blocked (`ownerId == request.auth.uid` + `isOwnerPrefixedId(derashaId)`).
  - State / Immortal Field Shortcutting: Blocked (`ownerId`, `sequenceNumber`, `createdAt` immutable; `updatedAt == request.time`).
  - Resource Poisoning: Blocked (`isValidId` <= 128 chars; all strings bounded).
  - Update Validation Wrapper: Verified (`isValidDerashaArchiveRecord(incoming())` wraps `allow update`).
  - Query Trust Test: Verified (`allow list` enforces `resource.data.ownerId == request.auth.uid`).
- **Collection `/comparative_studies/{studyId}`**:
  - Identity Spoofing: Blocked (`ownerId == request.auth.uid` + `isOwnerPrefixedId(studyId)`).
  - Immortal Field Integrity: Blocked (`ownerId`, `relationType`, `comparedLabel`, `createdAt` immutable; `updatedAt == request.time`).
  - Resource Poisoning: Blocked (`isValidId` <= 128 chars; all strings bounded; `relationType` enum-guarded).
  - Update Validation Wrapper: Verified (`isValidComparativeDerashaStudy(incoming())` wraps `allow update`).
  - Query Trust Test: Verified (`allow list` enforces `resource.data.ownerId == request.auth.uid`).
