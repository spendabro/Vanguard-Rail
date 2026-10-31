/**
 * Firestore Security Rules Verification Suite (Dirty Dozen Payloads)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Entry Create (authorUid mismatch)',
    collectionPath: '/entries/entry_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Entry Create (extra ghost key)',
    collectionPath: '/entries/entry_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoof (email_verified == false)',
    collectionPath: '/entries/entry_1',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Blanket Read on Another User Entry',
    collectionPath: '/entries/entry_other',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unscoped List Scraping on Entries',
    collectionPath: '/entries',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery (createdAt != request.time)',
    collectionPath: '/entries/entry_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'ID Poisoning Attack (invalid document ID characters)',
    collectionPath: '/entries/bad$id',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Denial-of-Wallet String Overflow (notes > 500 chars)',
    collectionPath: '/entries/entry_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Outbound Email Create (missing relatedEntryId doc)',
    collectionPath: '/outbound_emails/email_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Non-Admin Outbound Email Dispatch',
    collectionPath: '/outbound_emails/email_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immortal Field Mutation on Entry Update (authorUid changed)',
    collectionPath: '/entries/entry_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Privilege Escalation on /admins',
    collectionPath: '/admins/attacker_uid',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
];
