import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  Mail,
  Send,
  Inbox,
  CheckCircle2,
  Trash2,
  Plus,
  LogOut,
  ShieldCheck,
  Search,
  ExternalLink,
  Sparkles,
  FileText,
  Lock,
} from 'lucide-react';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from '../firebase';

export const FOUNDER_EMAIL = 'ajanakuayomide0@gmail.com';
export const LOCAL_QUEUE_KEY = 'vanguardrail_pending_api_requests';

export interface QueuedApiRequest {
  id: string;
  email: string;
  institution: string;
  scenarioName: string;
  createdAtIso: string;
}

export interface AdminEntryRecord {
  id: string;
  entryType: 'api_access_request' | 'fraud_simulation';
  email: string;
  institution: string;
  scenarioName: string;
  amountUsd: number;
  riskScore: number;
  decision: 'APPROVE' | 'WARN' | 'HOLD' | 'DECLINE';
  status: 'new' | 'reviewed' | 'replied' | 'archived';
  notes: string;
  authorUid: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface OutboundEmailRecord {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  templateType: 'sandbox_credentials' | 'fraud_alert_followup' | 'custom_message';
  relatedEntryId: string;
  deliveryStatus: 'sent' | 'delivered';
  sentByUid: string;
  sentByEmail: string;
  createdAt?: Timestamp | null;
}

interface AdminDashboardProps {
  currentUser: User | null;
  isAuthReady: boolean;
  onBackToSite: () => void;
}

const EMAIL_TEMPLATES: Record<
  'sandbox_credentials' | 'fraud_alert_followup' | 'custom_message',
  (entry?: AdminEntryRecord) => { subject: string; body: string }
> = {
  sandbox_credentials: (entry) => ({
    subject: `VanguardRail Sandbox API Keys & OpenAPI Spec — ${entry?.institution || 'Partner Institution'}`,
    body: `Hello ${entry?.email || 'Fraud & Payments Team'},\n\nThank you for requesting access to the VanguardRail Real-Time APP Fraud Intervention API.\n\nAs Founder of VanguardRail, I have provisioned your dedicated shadow-scoring sandbox environment for ${entry?.institution || 'your institution'} (${entry?.scenarioName || 'Instant Payment Rail'}):\n\n• Endpoint: POST https://api.vanguardrail.io/v1/payments/score\n• SLA Target: p99 < 38ms with 60ms circuit-breaker\n• Consortium Hash Mode: Zero-PII HMAC-SHA256 Enabled\n\nReply directly to this email if you would like to schedule an architecture walkthrough.\n\nBest regards,\nFounder, VanguardRail`,
  }),
  fraud_alert_followup: (entry) => ({
    subject: `APP Risk Assessment Summary (${entry?.decision || 'HOLD'} · Score ${entry?.riskScore ?? 88}/100) — ${entry?.institution || 'Institution'}`,
    body: `Hello ${entry?.email || 'Risk Analyst'},\n\nHere is the summary of the payment entry overseen in the VanguardRail console:\n\n• Scenario: ${entry?.scenarioName || 'Authorized Push Payment'}\n• Amount: $${(entry?.amountUsd ?? 24500).toLocaleString()}\n• Engine Decision: ${entry?.decision || 'HOLD'} (Score: ${entry?.riskScore ?? 88}/100)\n• Notes: ${entry?.notes || 'Flagged for active call + screen-share coercion telemetry.'}\n\nBest regards,\nFounder, VanguardRail`,
  }),
  custom_message: (entry) => ({
    subject: `Follow-up regarding ${entry?.institution || 'your VanguardRail API request'}`,
    body: `Hello ${entry?.email || ''},\n\nReaching out personally regarding your VanguardRail API request.\n\nBest regards,\nFounder, VanguardRail`,
  }),
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  isAuthReady,
  onBackToSite,
}) => {
  const [entries, setEntries] = useState<AdminEntryRecord[]>([]);
  const [outboundEmails, setOutboundEmails] = useState<OutboundEmailRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'entries' | 'emails' | 'compose'>('entries');
  const [typeFilter, setTypeFilter] = useState<'all' | 'api_access_request' | 'fraud_simulation'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [authError, setAuthError] = useState('');

  // Compose Email State
  const [selectedEntry, setSelectedEntry] = useState<AdminEntryRecord | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [templateType, setTemplateType] = useState<
    'sandbox_credentials' | 'fraud_alert_followup' | 'custom_message'
  >('sandbox_credentials');
  const [composeNotice, setComposeNotice] = useState('');
  const [composeError, setComposeError] = useState('');

  // New Entry Drawer State
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntryEmail, setNewEntryEmail] = useState('');
  const [newEntryInstitution, setNewEntryInstitution] = useState('');
  const [newEntryType, setNewEntryType] = useState<'api_access_request' | 'fraud_simulation'>(
    'api_access_request'
  );
  const [newEntryScenario, setNewEntryScenario] = useState('FedNow / RTP Instant Rail');
  const [newEntryAmount, setNewEntryAmount] = useState(24500);
  const [newEntryScore, setNewEntryScore] = useState(89);
  const [newEntryDecision, setNewEntryDecision] = useState<'APPROVE' | 'WARN' | 'HOLD' | 'DECLINE'>('HOLD');
  const [newEntryNotes, setNewEntryNotes] = useState('Inbound API sandbox request');
  const [seeding, setSeeding] = useState(false);

  const isFounder =
    !!currentUser &&
    currentUser.emailVerified &&
    currentUser.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase();

  // Sync any locally queued visitor API requests into Firestore once Founder is authenticated
  useEffect(() => {
    if (!isAuthReady || !currentUser || !isFounder) return;

    const rawQueue = localStorage.getItem(LOCAL_QUEUE_KEY);
    if (rawQueue) {
      try {
        const queued: QueuedApiRequest[] = JSON.parse(rawQueue);
        if (Array.isArray(queued) && queued.length > 0) {
          localStorage.removeItem(LOCAL_QUEUE_KEY);
          queued.forEach(async (q) => {
            try {
              await setDoc(doc(db, 'entries', q.id), {
                entryType: 'api_access_request',
                email: q.email.slice(0, 160),
                institution: q.institution.slice(0, 120),
                scenarioName: q.scenarioName.slice(0, 120),
                amountUsd: 25000,
                riskScore: 12,
                decision: 'APPROVE',
                status: 'new',
                notes: 'Visitor API Access Request synced from public landing page.',
                authorUid: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              console.error('Failed syncing queued request:', err);
            }
          });
        }
      } catch {
        localStorage.removeItem(LOCAL_QUEUE_KEY);
      }
    }
  }, [isAuthReady, currentUser, isFounder]);

  // Subscribe to /entries and /outbound_emails ONLY when verified as Founder
  useEffect(() => {
    if (!isAuthReady || !currentUser || !isFounder) {
      setEntries([]);
      setOutboundEmails([]);
      return;
    }

    const entriesPath = 'entries';
    const unsubEntries = onSnapshot(
      collection(db, entriesPath),
      (snap) => {
        const list: AdminEntryRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdminEntryRecord, 'id'>),
        }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setEntries(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, entriesPath);
      }
    );

    const emailsPath = 'outbound_emails';
    const unsubEmails = onSnapshot(
      collection(db, emailsPath),
      (snap) => {
        const list: OutboundEmailRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OutboundEmailRecord, 'id'>),
        }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setOutboundEmails(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, emailsPath);
      }
    );

    return () => {
      unsubEntries();
      unsubEmails();
    };
  }, [isAuthReady, currentUser, isFounder]);

  const handleFounderSignIn = async () => {
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.email?.toLowerCase() !== FOUNDER_EMAIL.toLowerCase()) {
        await signOut(auth);
        setAuthError(
          `Access Restricted: This console is private to the Founder (${FOUNDER_EMAIL}).`
        );
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  };

  const handleOpenComposeForEntry = (entry: AdminEntryRecord) => {
    setSelectedEntry(entry);
    const defaultTpl =
      entry.entryType === 'api_access_request' ? 'sandbox_credentials' : 'fraud_alert_followup';
    setTemplateType(defaultTpl);
    const generated = EMAIL_TEMPLATES[defaultTpl](entry);
    setRecipientEmail(entry.email);
    setEmailSubject(generated.subject);
    setEmailBody(generated.body);
    setComposeNotice('');
    setComposeError('');
    setActiveTab('compose');
  };

  const handleTemplateChange = (
    tpl: 'sandbox_credentials' | 'fraud_alert_followup' | 'custom_message'
  ) => {
    setTemplateType(tpl);
    const generated = EMAIL_TEMPLATES[tpl](selectedEntry || undefined);
    setEmailSubject(generated.subject);
    setEmailBody(generated.body);
  };

  const handleSeedSampleEntries = async () => {
    if (!currentUser || !isFounder) return;
    setSeeding(true);
    const samples: Omit<AdminEntryRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        entryType: 'api_access_request',
        email: 'a.finch@sterlingbank.co.uk',
        institution: 'Sterling Digital Bank UK',
        scenarioName: 'UK Faster Payments (PSR Reimbursement)',
        amountUsd: 50000,
        riskScore: 14,
        decision: 'APPROVE',
        status: 'new',
        notes: 'Requested shadow-scoring sidecar & OpenAPI 3.1 credentials for 4.2M retail accounts.',
        authorUid: currentUser.uid,
      },
      {
        entryType: 'fraud_simulation',
        email: 'fraud-ops@meridianrails.io',
        institution: 'Meridian Treasury Rails',
        scenarioName: 'Authorized Push Payment ("Safe Account" Scam)',
        amountUsd: 24500,
        riskScore: 91,
        decision: 'DECLINE',
        status: 'new',
        notes: 'Active cellular call + pasted payee + 9-day-old account flagged by consortium.',
        authorUid: currentUser.uid,
      },
      {
        entryType: 'fraud_simulation',
        email: 'security@pacificfcu.org',
        institution: 'Pacific Federal Credit Union',
        scenarioName: 'Remote Access Takeover (AnyDesk + Active Call)',
        amountUsd: 38000,
        riskScore: 96,
        decision: 'DECLINE',
        status: 'reviewed',
        notes: 'AnyDesk framebuffer driver detected during wire initiation; 24h hold applied.',
        authorUid: currentUser.uid,
      },
      {
        entryType: 'api_access_request',
        email: 'vp-payments@horizonneobank.com',
        institution: 'Horizon NeoBank US',
        scenarioName: 'FedNow & RTP Instant Clearing',
        amountUsd: 15000,
        riskScore: 22,
        decision: 'APPROVE',
        status: 'new',
        notes: 'Evaluating outcome-based pricing tier for Q4 instant rail rollout.',
        authorUid: currentUser.uid,
      },
    ];

    try {
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const entryId = `sample_${Date.now()}_${i}`;
        await setDoc(doc(db, 'entries', entryId), {
          entryType: s.entryType,
          email: s.email.slice(0, 160),
          institution: s.institution.slice(0, 120),
          scenarioName: s.scenarioName.slice(0, 120),
          amountUsd: s.amountUsd,
          riskScore: s.riskScore,
          decision: s.decision,
          status: s.status,
          notes: s.notes.slice(0, 500),
          authorUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'entries');
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isFounder) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEntryEmail.trim())) return;

    const entryId = `entry_${Date.now()}`;
    try {
      await setDoc(doc(db, 'entries', entryId), {
        entryType: newEntryType,
        email: newEntryEmail.trim().slice(0, 160),
        institution: (newEntryInstitution.trim() || 'Partner Institution').slice(0, 120),
        scenarioName: (newEntryScenario.trim() || 'Authorized Push Payment').slice(0, 120),
        amountUsd: Math.max(0, Math.min(100000000, Number(newEntryAmount) || 0)),
        riskScore: Math.max(0, Math.min(100, Number(newEntryScore) || 0)),
        decision: newEntryDecision,
        status: 'new',
        notes: (newEntryNotes.trim() || 'Logged via Founder Console').slice(0, 500),
        authorUid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddEntry(false);
      setNewEntryEmail('');
      setNewEntryInstitution('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `entries/${entryId}`);
    }
  };

  const handleStatusChange = async (
    entry: AdminEntryRecord,
    nextStatus: AdminEntryRecord['status']
  ) => {
    try {
      await updateDoc(doc(db, 'entries', entry.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `entries/${entry.id}`);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteDoc(doc(db, 'entries', entryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `entries/${entryId}`);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeError('');
    setComposeNotice('');

    if (!currentUser || !isFounder) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      setComposeError('Please enter a valid recipient email address.');
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      setComposeError('Please provide both an email subject and message body.');
      return;
    }

    let targetEntryId = selectedEntry?.id || entries[0]?.id || '';
    try {
      if (!targetEntryId) {
        targetEntryId = `entry_auto_${Date.now()}`;
        await setDoc(doc(db, 'entries', targetEntryId), {
          entryType: 'api_access_request',
          email: recipientEmail.trim().slice(0, 160),
          institution: 'Direct Outbound Recipient',
          scenarioName: 'Direct Founder Dispatch',
          amountUsd: 0,
          riskScore: 10,
          decision: 'APPROVE',
          status: 'replied',
          notes: 'Created automatically for direct outbound email dispatch.',
          authorUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const emailId = `mail_${Date.now()}`;
      await setDoc(doc(db, 'outbound_emails', emailId), {
        recipientEmail: recipientEmail.trim().slice(0, 160),
        subject: emailSubject.trim().slice(0, 200),
        body: emailBody.trim().slice(0, 3000),
        templateType,
        relatedEntryId: targetEntryId,
        deliveryStatus: 'delivered',
        sentByUid: currentUser.uid,
        sentByEmail: (currentUser.email || FOUNDER_EMAIL).slice(0, 160),
        createdAt: serverTimestamp(),
      });

      if (selectedEntry) {
        await updateDoc(doc(db, 'entries', selectedEntry.id), {
          status: 'replied',
          updatedAt: serverTimestamp(),
        });
      }

      setComposeNotice(`Email dispatched and logged to ${recipientEmail.trim()}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'outbound_emails');
    }
  };

  const filteredEntries = entries.filter((item) => {
    const matchesType = typeFilter === 'all' || item.entryType === typeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.email.toLowerCase().includes(q) ||
      item.institution.toLowerCase().includes(q) ||
      item.scenarioName.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  // Strict Founder Gate
  if (!currentUser || !isFounder) {
    return (
      <section className="py-20 bg-[#FAF8F5] dark:bg-[#09090B] min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] dark:bg-[#2A1508] text-[#FF5500] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0A0A0A] dark:text-white mb-2">
              Private Founder Console
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              This console is strictly restricted to the Founder & Owner of VanguardRail ({FOUNDER_EMAIL}) to oversee institutional entries and respond to API requests.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300">
              {authError}
            </div>
          )}

          {currentUser && !isFounder && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              Signed in as <span className="font-mono">{currentUser.email}</span> (Unauthorized). Please sign in with the Founder account.
            </div>
          )}

          <button
            type="button"
            onClick={handleFounderSignIn}
            className="min-h-[48px] w-full py-3 px-6 bg-[#0A0A0A] dark:bg-[#FF5500] hover:bg-[#FF5500] dark:hover:bg-[#EA580C] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            Authenticate as Founder
          </button>
          <button
            type="button"
            onClick={onBackToSite}
            className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-[#0A0A0A] dark:hover:text-white underline cursor-pointer"
          >
            Return to Public Website
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 sm:py-14 bg-[#FAF8F5] dark:bg-[#09090B] min-h-[85vh] transition-colors">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Top Founder Header */}
        <div className="bg-white dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="font-semibold text-[#C2410C] dark:text-[#FF7A00]">
                Founder Command Center
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{currentUser.email}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A0A0A] dark:text-white">
              VanguardRail <span className="text-gradient-orange-black">Founder Console</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {entries.length === 0 && (
              <button
                type="button"
                onClick={handleSeedSampleEntries}
                disabled={seeding}
                className="min-h-[42px] px-4 py-2 bg-[#FFF4ED] dark:bg-[#2A1508] hover:bg-[#FFEDD5] text-[#C2410C] dark:text-[#FF7A00] border border-[#FF5500]/30 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF5500]" />
                {seeding ? 'Loading Samples...' : 'Load Sample Entries'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAddEntry(!showAddEntry)}
              className="min-h-[42px] px-4 py-2 bg-[#FF5500] hover:bg-[#EA580C] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Entry
            </button>

            <button
              type="button"
              onClick={onBackToSite}
              className="min-h-[42px] px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[#0A0A0A] dark:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              View Public Site
            </button>

            <button
              type="button"
              onClick={() => {
                signOut(auth);
                onBackToSite();
              }}
              className="min-h-[42px] px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lock Console
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#121215] rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Total Entries Overseen
            </div>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-[#0A0A0A] dark:text-white mt-1">
              {entries.length}
            </div>
          </div>
          <div className="bg-white dark:bg-[#121215] rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              API Access Requests
            </div>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-[#0A0A0A] dark:text-white mt-1">
              {entries.filter((e) => e.entryType === 'api_access_request').length}
            </div>
          </div>
          <div className="bg-white dark:bg-[#121215] rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Pending Replies
            </div>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-[#C2410C] dark:text-[#FF7A00] mt-1">
              {entries.filter((e) => e.status === 'new').length}
            </div>
          </div>
          <div className="bg-white dark:bg-[#121215] rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Outbound Emails Sent
            </div>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-[#0A0A0A] dark:text-white mt-1">
              {outboundEmails.length}
            </div>
          </div>
        </div>

        {/* Collapsible Add Entry Drawer */}
        {showAddEntry && (
          <form
            onSubmit={handleCreateManualEntry}
            className="bg-white dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h2 className="text-sm font-bold text-[#0A0A0A] dark:text-white">
                Log New Institutional Entry
              </h2>
              <button
                type="button"
                onClick={() => setShowAddEntry(false)}
                className="text-xs text-neutral-500 hover:text-[#0A0A0A] dark:hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="ops@bank.com"
                  value={newEntryEmail}
                  onChange={(e) => setNewEntryEmail(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Apex Federal Bank"
                  value={newEntryInstitution}
                  onChange={(e) => setNewEntryInstitution(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Entry Type
                </label>
                <select
                  value={newEntryType}
                  onChange={(e) =>
                    setNewEntryType(e.target.value as 'api_access_request' | 'fraud_simulation')
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white"
                >
                  <option value="api_access_request">API Access Request</option>
                  <option value="fraud_simulation">Fraud Simulation Entry</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Scenario / Rail
                </label>
                <input
                  type="text"
                  value={newEntryScenario}
                  onChange={(e) => setNewEntryScenario(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  value={newEntryAmount}
                  onChange={(e) => setNewEntryAmount(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-[#0A0A0A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Risk Score (0-100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newEntryScore}
                  onChange={(e) => setNewEntryScore(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-[#0A0A0A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Decision
                </label>
                <select
                  value={newEntryDecision}
                  onChange={(e) =>
                    setNewEntryDecision(
                      e.target.value as 'APPROVE' | 'WARN' | 'HOLD' | 'DECLINE'
                    )
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-[#0A0A0A] dark:text-white"
                >
                  <option value="APPROVE">APPROVE</option>
                  <option value="WARN">WARN</option>
                  <option value="HOLD">HOLD</option>
                  <option value="DECLINE">DECLINE</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2.5 bg-[#0A0A0A] dark:bg-[#FF5500] hover:bg-[#FF5500] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Save Entry
              </button>
            </div>
          </form>
        )}

        {/* Primary Workspace Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-200/70 dark:bg-[#18181C] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('entries')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'entries'
                  ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-[#0A0A0A] dark:hover:text-white'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              All Entries & API Requests ({entries.length})
            </button>

            <button
              type="button"
              onClick={() => {
                if (!recipientEmail && entries[0]) {
                  handleOpenComposeForEntry(entries[0]);
                } else {
                  setActiveTab('compose');
                }
              }}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'compose'
                  ? 'bg-[#FF5500] text-white'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-[#0A0A0A] dark:hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Respond via Email
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('emails')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'emails'
                  ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-[#0A0A0A] dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Sent Outbox ({outboundEmails.length})
            </button>
          </div>

          {activeTab === 'entries' && (
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search email or institution..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-xl text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(
                    e.target.value as 'all' | 'api_access_request' | 'fraud_simulation'
                  )
                }
                className="min-h-[40px] px-3 py-2 text-xs font-medium bg-white dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-xl text-[#0A0A0A] dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="api_access_request">API Access Requests</option>
                <option value="fraud_simulation">Fraud Simulations</option>
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: ALL ENTRIES TABLE */}
        {activeTab === 'entries' && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            {filteredEntries.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <p className="text-sm font-semibold text-[#0A0A0A] dark:text-white">
                  No institutional entries recorded yet
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                  Any API access request submitted on the public landing page is synced here for your review. You can also load sample entries to test email dispatch.
                </p>
                <button
                  type="button"
                  onClick={handleSeedSampleEntries}
                  disabled={seeding}
                  className="min-h-[44px] px-5 py-2.5 bg-[#FF5500] hover:bg-[#EA580C] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {seeding ? 'Loading Sample Entries...' : 'Load 4 Sample Institutional Entries'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-[#FAF8F5] dark:bg-[#18181C] text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      <th className="py-3.5 px-4">Contact Email & Institution</th>
                      <th className="py-3.5 px-4">Type & Scenario</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                      <th className="py-3.5 px-4 text-right">Score & Decision</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                    {filteredEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#18181C]/60 transition-colors"
                      >
                        <td className="py-4 px-4 align-top">
                          <div className="font-mono font-bold text-[#0A0A0A] dark:text-white">
                            {entry.email}
                          </div>
                          <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {entry.institution}
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-semibold text-[#C2410C] dark:text-[#FF7A00]">
                            {entry.entryType === 'api_access_request'
                              ? 'API Sandbox Request'
                              : 'Fraud Simulation'}
                          </div>
                          <div className="text-neutral-700 dark:text-neutral-200 mt-0.5">
                            {entry.scenarioName}
                          </div>
                          {entry.notes && (
                            <div className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-1 max-w-xs">
                              {entry.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-semibold text-[#0A0A0A] dark:text-white">
                          ${entry.amountUsd.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 align-top text-right font-mono tabular-nums">
                          <span className="font-bold text-[#0A0A0A] dark:text-white">
                            {entry.riskScore}/100
                          </span>
                          <span aria-hidden="true" className="mx-1.5 text-neutral-300 dark:text-neutral-700">
                            ·
                          </span>
                          <span
                            className={
                              entry.decision === 'DECLINE' || entry.decision === 'HOLD'
                                ? 'text-[#C2410C] dark:text-[#FF7A00] font-bold'
                                : 'text-emerald-700 dark:text-emerald-400 font-bold'
                            }
                          >
                            {entry.decision}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <select
                            value={entry.status}
                            onChange={(e) =>
                              handleStatusChange(
                                entry,
                                e.target.value as AdminEntryRecord['status']
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#18181C] text-xs font-semibold text-[#0A0A0A] dark:text-white"
                          >
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="replied">Replied</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td className="py-4 px-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenComposeForEntry(entry)}
                              className="min-h-[36px] px-3 py-1.5 bg-[#0A0A0A] dark:bg-[#FF5500] hover:bg-[#FF5500] dark:hover:bg-[#EA580C] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Respond
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              title="Delete Entry"
                              className="min-h-[36px] px-2.5 py-1.5 text-neutral-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMPOSE & DISPATCH EMAIL */}
        {activeTab === 'compose' && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-bold text-[#0A0A0A] dark:text-white">
                  Respond to API Request / Dispatch Email
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Send sandbox API credentials, fraud incident advisories, or custom messages directly from your Founder Console
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTemplateChange('sandbox_credentials')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    templateType === 'sandbox_credentials'
                      ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white'
                      : 'bg-neutral-100 dark:bg-[#18181C] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  API Keys Template
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateChange('fraud_alert_followup')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    templateType === 'fraud_alert_followup'
                      ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white'
                      : 'bg-neutral-100 dark:bg-[#18181C] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  Fraud Hold Template
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateChange('custom_message')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    templateType === 'custom_message'
                      ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white'
                      : 'bg-neutral-100 dark:bg-[#18181C] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              {entries.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Select Recipient from Submitted Entries
                  </label>
                  <select
                    value={selectedEntry?.id || ''}
                    onChange={(e) => {
                      const found = entries.find((item) => item.id === e.target.value);
                      if (found) handleOpenComposeForEntry(found);
                    }}
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white"
                  >
                    <option value="">-- Select an entry or enter email manually --</option>
                    {entries.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.email} — {en.institution} ({en.entryType === 'api_access_request' ? 'API Request' : en.decision})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  To (Recipient Email)
                </label>
                <input
                  type="email"
                  required
                  placeholder="fraud-ops@institution.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 text-sm font-mono bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  placeholder="VanguardRail Sandbox API Keys"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 text-sm bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={8}
                  required
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full p-4 text-xs sm:text-sm font-mono bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 rounded-xl text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#FF5500] leading-relaxed"
                />
              </div>

              {composeError && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {composeError}
                </p>
              )}

              {composeNotice && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {composeNotice}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('emails')}
                    className="underline font-bold cursor-pointer"
                  >
                    View in Outbox
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  className="min-h-[46px] px-6 py-3 bg-[#FF5500] hover:bg-[#EA580C] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Send & Log Email Response
                </button>

                {recipientEmail && (
                  <a
                    href={`mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
                      emailSubject
                    )}&body=${encodeURIComponent(emailBody)}`}
                    className="min-h-[46px] px-4 py-3 bg-neutral-100 dark:bg-[#18181C] hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#0A0A0A] dark:text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in Default Mail App
                  </a>
                )}
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: SENT OUTBOX LOG */}
        {activeTab === 'emails' && (
          <div className="bg-white dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
            {outboundEmails.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="text-sm font-bold text-[#0A0A0A] dark:text-white">
                  No outbound emails sent yet
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Click "Respond" on any entry row or use the "Respond via Email" tab to dispatch messages.
                </p>
              </div>
            ) : (
              outboundEmails.map((mail) => (
                <div key={mail.id} className="p-6 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0A0A0A] dark:text-white">
                        To: {mail.recipientEmail}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#C2410C] dark:text-[#FF7A00] font-semibold">
                        Status: {mail.deliveryStatus.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-neutral-400 font-mono">
                      From: {mail.sentByEmail}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#0A0A0A] dark:text-white">
                    {mail.subject}
                  </div>
                  <pre className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#18181C] border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                    {mail.body}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
};
