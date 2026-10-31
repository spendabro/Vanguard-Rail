export type PaymentPurpose =
  | 'safe_account'
  | 'crypto_exchange'
  | 'urgent_invoice'
  | 'tax_authority'
  | 'family_support'
  | 'property_escrow';

export type CoPStatus = 'match' | 'partial_match' | 'no_match' | 'unavailable';

export interface SignalInputState {
  amountUsd: number;
  baselineAvgUsd: number;
  isFirstTimePayee: boolean;
  recentLimitIncrease: boolean;
  activePhoneCall: boolean;
  remoteAccessToolDetected: boolean;
  copiedPayeeAccount: boolean;
  hesitationBursts: number;
  statedPurpose: PaymentPurpose;
  payeeAccountAgeDays: number;
  inboundUnrelatedSenders24h: number;
  copStatus: CoPStatus;
  consortiumMuleFlag: boolean;
  holdThreshold: number;
}

export interface SignalAttribution {
  id: string;
  category: 'Behavioral' | 'Session & Biometrics' | 'Payment Context' | 'Payee Intelligence' | 'Consortium Graph';
  label: string;
  impactPoints: number;
  detail: string;
}

export type DecisionAction = 'APPROVE' | 'WARN' | 'HOLD' | 'DECLINE';

export interface RiskEvaluationResult {
  score: number;
  decision: DecisionAction;
  confidencePct: number;
  latencyMs: number;
  scamArchetype: string;
  headlineWarning: string;
  customerAdvisory: string;
  recommendedFriction: string;
  callbackScript: string;
  attributions: SignalAttribution[];
}

export interface PresetScenario {
  id: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  scamCategory: string;
  senderProfile: string;
  payeeName: string;
  payeeBank: string;
  payeeAccountMasked: string;
  state: SignalInputState;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'authorized-push-payment',
    shortLabel: 'Authorized Push Payment (APP)',
    title: 'Authorized Push Payment ("Safe Account" Scam)',
    subtitle: 'Customer tricked by bank impersonator into pushing $24,500 to a mule vault',
    scamCategory: 'APP Social Engineering',
    senderProfile: 'Eleanor Vance · Avg transfer $420',
    payeeName: 'Apex Holdings Logistics Ltd',
    payeeBank: 'Metro NeoBank Instant Rail',
    payeeAccountMasked: '•••• 8841 (Opened 9d ago)',
    state: {
      amountUsd: 24500,
      baselineAvgUsd: 420,
      isFirstTimePayee: true,
      recentLimitIncrease: true,
      activePhoneCall: true,
      remoteAccessToolDetected: false,
      copiedPayeeAccount: true,
      hesitationBursts: 5,
      statedPurpose: 'safe_account',
      payeeAccountAgeDays: 9,
      inboundUnrelatedSenders24h: 14,
      copStatus: 'no_match',
      consortiumMuleFlag: true,
      holdThreshold: 72,
    },
  },
  {
    id: 'remote-access-scam',
    shortLabel: 'Remote Access Coaching',
    title: 'Remote Access Takeover (AnyDesk + Active Call)',
    subtitle: 'Scammer viewing screen via AnyDesk while coaching victim over cellular call',
    scamCategory: 'Remote Access Coercion',
    senderProfile: 'Robert Sterling · Avg transfer $890',
    payeeName: 'Global Digital Settlement Hub',
    payeeBank: 'Cross-Rail Instant Clearing',
    payeeAccountMasked: '•••• 5512 (Opened 4d ago)',
    state: {
      amountUsd: 38000,
      baselineAvgUsd: 890,
      isFirstTimePayee: true,
      recentLimitIncrease: true,
      activePhoneCall: true,
      remoteAccessToolDetected: true,
      copiedPayeeAccount: true,
      hesitationBursts: 7,
      statedPurpose: 'safe_account',
      payeeAccountAgeDays: 4,
      inboundUnrelatedSenders24h: 19,
      copStatus: 'no_match',
      consortiumMuleFlag: true,
      holdThreshold: 72,
    },
  },
  {
    id: 'ai-voice-ceo-invoice',
    shortLabel: 'AI Voice Invoice Redirect',
    title: 'AI Voice-Clone Executive Wire Redirect',
    subtitle: 'Urgent supplier bank change + CoP mismatch + rapid inbound velocity',
    scamCategory: 'Deepfake BEC Fraud',
    senderProfile: 'Marcus Chen · Controller · Avg $3,800',
    payeeName: 'K. Miller Trading Account',
    payeeBank: 'First Horizon Instant Clearing',
    payeeAccountMasked: '•••• 3109 (Opened 18d ago)',
    state: {
      amountUsd: 48000,
      baselineAvgUsd: 3800,
      isFirstTimePayee: true,
      recentLimitIncrease: true,
      activePhoneCall: true,
      remoteAccessToolDetected: false,
      copiedPayeeAccount: true,
      hesitationBursts: 4,
      statedPurpose: 'urgent_invoice',
      payeeAccountAgeDays: 18,
      inboundUnrelatedSenders24h: 9,
      copStatus: 'no_match',
      consortiumMuleFlag: false,
      holdThreshold: 72,
    },
  },
  {
    id: 'legitimate-escrow-wire',
    shortLabel: 'Legitimate Instant Wire',
    title: 'Legitimate High-Value Property Escrow',
    subtitle: 'Clean session biometrics, tenured commercial payee & verified CoP match',
    scamCategory: 'Legitimate Transfer',
    senderProfile: 'Sophia Martinez · Avg transfer $1,100',
    payeeName: 'Pacific Coast Title & Escrow Co.',
    payeeBank: 'JPMorgan Chase Real-Time Rail',
    payeeAccountMasked: '•••• 4401 (Opened 2,840d ago)',
    state: {
      amountUsd: 35000,
      baselineAvgUsd: 1100,
      isFirstTimePayee: true,
      recentLimitIncrease: false,
      activePhoneCall: false,
      remoteAccessToolDetected: false,
      copiedPayeeAccount: false,
      hesitationBursts: 0,
      statedPurpose: 'property_escrow',
      payeeAccountAgeDays: 2840,
      inboundUnrelatedSenders24h: 2,
      copStatus: 'match',
      consortiumMuleFlag: false,
      holdThreshold: 72,
    },
  },
];

export function evaluatePaymentRisk(input: SignalInputState): RiskEvaluationResult {
  const attributions: SignalAttribution[] = [];
  let rawScore = 4;

  const multiplier = input.amountUsd / Math.max(input.baselineAvgUsd, 50);
  if (multiplier >= 20) {
    const pts = 18;
    rawScore += pts;
    attributions.push({
      id: 'amount-anomaly',
      category: 'Behavioral',
      label: `${multiplier.toFixed(1)}x Above Customer Baseline`,
      impactPoints: pts,
      detail: `Transfer of $${input.amountUsd.toLocaleString()} exceeds 90-day baseline ($${input.baselineAvgUsd.toLocaleString()}).`,
    });
  } else if (multiplier >= 6) {
    const pts = 10;
    rawScore += pts;
    attributions.push({
      id: 'amount-anomaly',
      category: 'Behavioral',
      label: `${multiplier.toFixed(1)}x Above Customer Baseline`,
      impactPoints: pts,
      detail: `Transfer amount is elevated compared to historical mean.`,
    });
  }

  if (input.remoteAccessToolDetected) {
    const pts = 26;
    rawScore += pts;
    attributions.push({
      id: 'remote-desktop',
      category: 'Session & Biometrics',
      label: 'Remote Access Tool Active (AnyDesk)',
      impactPoints: pts,
      detail: 'Virtual display driver / screen-sharing overlay detected during payment session.',
    });
  }

  if (input.activePhoneCall) {
    const pts = 19;
    rawScore += pts;
    attributions.push({
      id: 'active-call',
      category: 'Session & Biometrics',
      label: 'Concurrent Voice Call Active',
      impactPoints: pts,
      detail: 'User is on an active phone call while authorizing a high-value push transfer.',
    });
  }

  if (input.copiedPayeeAccount || input.hesitationBursts >= 3) {
    const pts = (input.copiedPayeeAccount ? 8 : 0) + (input.hesitationBursts >= 3 ? 7 : 0);
    rawScore += pts;
    attributions.push({
      id: 'biometric-cadence',
      category: 'Session & Biometrics',
      label: 'Coached Cadence & Pasted Payee',
      impactPoints: pts,
      detail: 'Routing details pasted from clipboard with hesitation pauses.',
    });
  }

  if (input.statedPurpose === 'safe_account') {
    const pts = 24;
    rawScore += pts;
    attributions.push({
      id: 'purpose-safe-account',
      category: 'Payment Context',
      label: '"Safe Account" Impersonation Pattern',
      impactPoints: pts,
      detail: 'Customer selected protective vault transfer after limit escalation.',
    });
  } else if (input.statedPurpose === 'urgent_invoice' && input.isFirstTimePayee) {
    const pts = 15;
    rawScore += pts;
    attributions.push({
      id: 'purpose-invoice',
      category: 'Payment Context',
      label: 'First-Time Supplier Wire Redirect',
      impactPoints: pts,
      detail: 'Urgent vendor settlement to newly added counterparty.',
    });
  }

  if (input.payeeAccountAgeDays < 30) {
    const pts = 15;
    rawScore += pts;
    attributions.push({
      id: 'payee-age',
      category: 'Payee Intelligence',
      label: `Newly Opened Payee (${input.payeeAccountAgeDays}d old)`,
      impactPoints: pts,
      detail: `Receiving account opened ${input.payeeAccountAgeDays} days ago.`,
    });
  } else if (input.payeeAccountAgeDays > 365 && input.inboundUnrelatedSenders24h <= 3) {
    const pts = -14;
    rawScore += pts;
    attributions.push({
      id: 'payee-tenure-trust',
      category: 'Payee Intelligence',
      label: `Tenured Commercial Payee (${Math.round(input.payeeAccountAgeDays / 365)} yrs)`,
      impactPoints: pts,
      detail: 'Receiving account has multi-year settlement history.',
    });
  }

  if (input.copStatus === 'no_match') {
    const pts = 16;
    rawScore += pts;
    attributions.push({
      id: 'cop-mismatch',
      category: 'Payee Intelligence',
      label: 'Confirmation of Payee (CoP) Mismatch',
      impactPoints: pts,
      detail: 'Entered payee name does not match legal account holder title.',
    });
  } else if (input.copStatus === 'match') {
    const pts = -10;
    rawScore += pts;
    attributions.push({
      id: 'cop-verified',
      category: 'Payee Intelligence',
      label: 'Confirmation of Payee (CoP) Verified',
      impactPoints: pts,
      detail: 'Exact legal title match confirmed by receiving bank.',
    });
  }

  if (input.consortiumMuleFlag) {
    const pts = 22;
    rawScore += pts;
    attributions.push({
      id: 'consortium-mule-match',
      category: 'Consortium Graph',
      label: 'Consortium Mule Fan-In Match',
      impactPoints: pts,
      detail: 'Payee account received rapid inbound transfers from 14 unrelated senders in 24h.',
    });
  }

  const score = Math.max(2, Math.min(99, Math.round(rawScore)));
  attributions.sort((a, b) => Math.abs(b.impactPoints) - Math.abs(a.impactPoints));

  let decision: DecisionAction = 'APPROVE';
  if (score >= 88) {
    decision = 'DECLINE';
  } else if (score >= input.holdThreshold) {
    decision = 'HOLD';
  } else if (score >= 42) {
    decision = 'WARN';
  }

  let scamArchetype = 'Verified Low-Risk Payment';
  let headlineWarning = 'Beneficiary Verified — Ready for Instant Settlement';
  let customerAdvisory =
    'Confirmation of Payee matched and session telemetry aligns with normal usage. Zero friction applied.';
  let recommendedFriction = 'Instant Rail Execution (No Friction)';
  let callbackScript = 'Payment cleared in 34ms.';

  if (input.remoteAccessToolDetected) {
    scamArchetype = 'Remote Access Coercion Scam (AnyDesk / Screen-Share)';
    headlineWarning = 'CRITICAL: Remote Screen-Sharing Detected During Transfer';
    customerAdvisory =
      'An active screen-sharing session (AnyDesk/TeamViewer) and voice call were detected. Scammers use remote access tools to watch your screen and coerce transfers. Disconnect immediately.';
    recommendedFriction = 'Immediate Payment Block + Outbound Fraud Specialist Callback';
    callbackScript = 'Session locked until customer disconnects remote desktop tool and confirms via callback.';
  } else if (input.statedPurpose === 'safe_account' || input.activePhoneCall) {
    scamArchetype = 'Authorized Push Payment ("Safe Account" Bank Impersonation)';
    headlineWarning = 'STOP: Your bank will NEVER ask you to move money to a "Safe Account"';
    customerAdvisory =
      'You are on an active phone call while sending funds to an unverified new payee. Fraudsters impersonate bank or government officials to trick you into authorizing transfers yourself.';
    recommendedFriction = '24-Hour Protective Cooling-Off Hold + AI/Human Callback';
    callbackScript = '24h hold applied; outbound verification call queued.';
  } else if (input.copStatus === 'no_match' || score >= 42) {
    scamArchetype = 'Invoice Redirection / High-Velocity Mule Risk';
    headlineWarning = 'Payee Name Mismatch on High-Value Transfer';
    customerAdvisory =
      'The account number entered does not match the legal business name on file at the receiving bank. Verify payment instructions via a known phone number before sending.';
    recommendedFriction = 'Out-of-Band Dual Approval + CoP Warning Acknowledgement';
    callbackScript = 'Step-up verification required prior to rail release.';
  }

  return {
    score,
    decision,
    confidencePct: Math.min(99.4, Number((84 + score * 0.15).toFixed(1))),
    latencyMs: 34 + (attributions.length % 9),
    scamArchetype,
    headlineWarning,
    customerAdvisory,
    recommendedFriction,
    callbackScript,
    attributions,
  };
}
