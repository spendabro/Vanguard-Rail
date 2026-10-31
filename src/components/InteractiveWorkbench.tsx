import React, { useState } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  MonitorUp,
  Copy,
  Check,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Terminal,
  Smartphone,
} from 'lucide-react';
import {
  PRESET_SCENARIOS,
  evaluatePaymentRisk,
  SignalInputState,
} from '../data/fraudScenarios';

export const InteractiveWorkbench: React.FC = () => {
  const [simulatorOpen, setSimulatorOpen] = useState<boolean>(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(PRESET_SCENARIOS[0].id);
  const [signalState, setSignalState] = useState<SignalInputState>(PRESET_SCENARIOS[0].state);
  const [showCustomSignals, setShowCustomSignals] = useState<boolean>(false);
  const [customerResolution, setCustomerResolution] = useState<'pending' | 'cancelled' | 'proceeded'>('pending');
  const [copiedJson, setCopiedJson] = useState(false);

  const currentScenario =
    PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId) || PRESET_SCENARIOS[0];
  const evaluation = evaluatePaymentRisk(signalState);

  const handleSelectScenario = (scenarioId: string) => {
    const found = PRESET_SCENARIOS.find((s) => s.id === scenarioId);
    if (found) {
      setSelectedScenarioId(found.id);
      setSignalState({ ...found.state });
      setCustomerResolution('pending');
    }
  };

  const updateField = <K extends keyof SignalInputState>(key: K, value: SignalInputState[K]) => {
    setSignalState((prev) => ({ ...prev, [key]: value }));
    setCustomerResolution('pending');
  };

  const apiPayload = {
    endpoint: 'POST /v1/payments/score',
    scenario_id: selectedScenarioId,
    decision: evaluation.decision,
    app_risk_score: evaluation.score,
    confidence_pct: evaluation.confidencePct,
    sla_latency_ms: evaluation.latencyMs,
    scam_classification: evaluation.scamArchetype,
    telemetry_signals: {
      amount_usd: signalState.amountUsd,
      active_voice_call: signalState.activePhoneCall,
      remote_access_driver: signalState.remoteAccessToolDetected ? 'ANYDESK_ACTIVE' : 'NONE',
      cop_name_match: signalState.copStatus,
      consortium_mule_flag: signalState.consortiumMuleFlag,
    },
    recommended_intervention: {
      friction_mode: evaluation.recommendedFriction,
      customer_headline: evaluation.headlineWarning,
    },
    reason_codes: evaluation.attributions.slice(0, 3).map((a) => ({
      signal: a.label,
      weight_delta: a.impactPoints > 0 ? `+${a.impactPoints}` : `${a.impactPoints}`,
    })),
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(apiPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  return (
    <section
      id="risk-engine"
      className="py-16 sm:py-24 bg-[#FAF8F5] dark:bg-[#121215] border-y border-neutral-200 dark:border-neutral-800 transition-colors"
    >
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        {/* Top Bar with Toggleable Fraud Simulator Switch */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] tracking-wide mb-2">
              Live Sandbox & Engine Telemetry
            </p>
            <h2
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0A0A0A] dark:text-white"
              style={{ textWrap: 'balance' }}
            >
              Real-Time <span className="text-gradient-orange-black">Fraud Simulator</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSimulatorOpen(!simulatorOpen)}
              aria-pressed={simulatorOpen}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
                simulatorOpen
                  ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white border-[#0A0A0A] dark:border-[#FF5500]'
                  : 'bg-white dark:bg-[#18181C] text-[#0A0A0A] dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:border-[#0A0A0A] dark:hover:border-white'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  simulatorOpen ? 'bg-[#FF5500] dark:bg-white' : 'bg-neutral-400'
                }`}
              />
              <span>Fraud Simulator: {simulatorOpen ? 'ACTIVE' : 'PAUSED'}</span>
            </button>
          </div>
        </div>

        {simulatorOpen ? (
          <div className="space-y-6">
            {/* Step 1: Scam Scenario Selector */}
            <div className="bg-white dark:bg-[#09090B] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-[#0A0A0A] dark:text-white">
                    1. Select Scam Scenario to Simulate
                  </label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Tap a scenario below or fine-tune live session signals to inspect the instant API response
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomSignals(!showCustomSignals)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    showCustomSignals
                      ? 'bg-[#FFF4ED] dark:bg-[#2A1508] border-[#FF5500] text-[#9A3412] dark:text-[#FF7A00]'
                      : 'bg-neutral-50 dark:bg-[#18181C] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-[#FF5500]" />
                  {showCustomSignals ? 'Hide Signal Controls' : 'Tune Signals'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PRESET_SCENARIOS.map((scenario) => {
                  const active = scenario.id === selectedScenarioId;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => handleSelectScenario(scenario.id)}
                      className={`min-h-[60px] text-left p-3.5 rounded-xl border transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between ${
                        active
                          ? 'bg-[#0A0A0A] dark:bg-[#FF5500] text-white border-[#0A0A0A] dark:border-[#FF5500] shadow-xs'
                          : 'bg-[#FAF8F5] dark:bg-[#141418] text-[#0A0A0A] dark:text-neutral-100 border-neutral-200 dark:border-neutral-800 hover:border-[#FF5500]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span
                          className={
                            active
                              ? 'text-[#FF7A00] dark:text-white font-semibold'
                              : 'text-[#C2410C] dark:text-[#FF7A00] font-semibold'
                          }
                        >
                          {scenario.scamCategory}
                        </span>
                        <span
                          className={`font-mono tabular-nums ${
                            active
                              ? 'text-neutral-300 dark:text-orange-100'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          ${scenario.state.amountUsd.toLocaleString()}
                        </span>
                      </div>
                      <div className="font-bold text-xs sm:text-sm leading-snug">
                        {scenario.shortLabel}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showCustomSignals && (
                <div className="mt-5 pt-5 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0A0A0A] dark:text-white">
                      Custom Telemetry Overrides ({currentScenario.senderProfile})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectScenario(selectedScenarioId)}
                      className="min-h-[36px] self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Scenario Defaults
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        Payment Amount
                      </span>
                      <span className="font-mono font-bold text-[#0A0A0A] dark:text-white tabular-nums">
                        ${signalState.amountUsd.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={60000}
                      step={500}
                      value={signalState.amountUsd}
                      onChange={(e) => updateField('amountUsd', Number(e.target.value))}
                      className="w-full h-2 accent-[#FF5500] cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => updateField('activePhoneCall', !signalState.activePhoneCall)}
                      className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        signalState.activePhoneCall
                          ? 'bg-[#FFF4ED] dark:bg-[#2A1508] border-[#FF5500] text-[#9A3412] dark:text-[#FF7A00]'
                          : 'bg-neutral-50 dark:bg-[#141418] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <PhoneCall className="w-3.5 h-3.5 text-[#FF5500]" />
                        Active Call
                      </span>
                      <span className="font-mono">{signalState.activePhoneCall ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateField('remoteAccessToolDetected', !signalState.remoteAccessToolDetected)
                      }
                      className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        signalState.remoteAccessToolDetected
                          ? 'bg-[#FFF4ED] dark:bg-[#2A1508] border-[#FF5500] text-[#9A3412] dark:text-[#FF7A00]'
                          : 'bg-neutral-50 dark:bg-[#141418] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <MonitorUp className="w-3.5 h-3.5 text-[#FF5500]" />
                        Remote Access
                      </span>
                      <span className="font-mono">
                        {signalState.remoteAccessToolDetected ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateField(
                          'copStatus',
                          signalState.copStatus === 'no_match' ? 'match' : 'no_match'
                        )
                      }
                      className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        signalState.copStatus === 'no_match'
                          ? 'bg-[#FFF4ED] dark:bg-[#2A1508] border-[#FF5500] text-[#9A3412] dark:text-[#FF7A00]'
                          : 'bg-neutral-50 dark:bg-[#141418] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span>CoP Mismatch</span>
                      <span className="font-mono">
                        {signalState.copStatus === 'no_match' ? 'YES' : 'NO'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateField('consortiumMuleFlag', !signalState.consortiumMuleFlag)
                      }
                      className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        signalState.consortiumMuleFlag
                          ? 'bg-[#0A0A0A] dark:bg-[#FF5500] border-[#0A0A0A] dark:border-[#FF5500] text-white'
                          : 'bg-neutral-50 dark:bg-[#141418] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span>Mule Flag</span>
                      <span
                        className={`font-mono ${
                          signalState.consortiumMuleFlag ? 'text-[#FF7A00] dark:text-white' : ''
                        }`}
                      >
                        {signalState.consortiumMuleFlag ? 'FLAGGED' : 'CLEAN'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Side-by-Side Live JSON API Response & Customer Intervention Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-6 bg-[#0A0A0A] dark:bg-[#050507] text-white rounded-2xl border border-neutral-900 dark:border-neutral-800 p-5 sm:p-6 flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-white/15">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#FF7A00] shrink-0" />
                      <span className="text-xs font-mono font-bold text-white">
                        VanguardRail Engine API Response
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#FF7A00] tabular-nums">
                        {evaluation.latencyMs}ms
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyJson}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedJson ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedJson ? 'Copied' : 'Copy JSON'}
                      </button>
                    </div>
                  </div>

                  <pre className="w-full max-w-full text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap break-words sm:whitespace-pre leading-relaxed max-h-[340px]">
                    {JSON.stringify(apiPayload, null, 2)}
                  </pre>
                </div>

                <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-neutral-400 font-mono">
                  <span>POST /v1/payments/score</span>
                  <span className="text-[#FF7A00] font-bold">
                    HTTP 200 · {evaluation.decision}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6 bg-white dark:bg-[#09090B] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-[#FF5500] shrink-0" />
                      <span className="text-xs font-bold text-[#0A0A0A] dark:text-white">
                        In-App Customer Intervention
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                        Score:{' '}
                        <strong className="text-[#0A0A0A] dark:text-white text-sm">
                          {evaluation.score}/100
                        </strong>
                      </span>
                      <span
                        className={`px-3 py-1 rounded-lg font-mono text-xs font-bold ${
                          evaluation.decision === 'DECLINE'
                            ? 'bg-[#0A0A0A] dark:bg-red-950 text-[#FF5500] dark:text-red-300 border border-transparent dark:border-red-800'
                            : evaluation.decision === 'HOLD'
                            ? 'bg-[#FF5500] text-white'
                            : evaluation.decision === 'WARN'
                            ? 'bg-[#FFF4ED] dark:bg-[#2A1508] text-[#C2410C] dark:text-[#FF7A00] border border-[#FF5500]/40'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {evaluation.decision}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    <span>
                      Payee:{' '}
                      <strong className="text-[#0A0A0A] dark:text-white">
                        {currentScenario.payeeName}
                      </strong>
                    </span>
                    <span className="font-mono">{currentScenario.payeeAccountMasked}</span>
                  </div>

                  <div
                    className={`p-4 rounded-xl mb-5 ${
                      evaluation.decision === 'APPROVE'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                        : 'bg-[#0A0A0A] dark:bg-[#141418] border border-transparent dark:border-neutral-800 text-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {evaluation.decision === 'APPROVE' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-[#FF5500] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div
                          className={`text-sm font-bold mb-1 ${
                            evaluation.decision === 'APPROVE'
                              ? 'text-emerald-900 dark:text-emerald-200'
                              : 'text-[#FF7A00]'
                          }`}
                        >
                          {evaluation.headlineWarning}
                        </div>
                        <p
                          className={`text-xs leading-relaxed ${
                            evaluation.decision === 'APPROVE'
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : 'text-neutral-300'
                          }`}
                        >
                          {evaluation.customerAdvisory}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  {customerResolution === 'pending' ? (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      {evaluation.decision !== 'APPROVE' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setCustomerResolution('cancelled')}
                            className="min-h-[44px] flex-1 py-3 px-4 bg-[#FF5500] hover:bg-[#EA580C] active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            Cancel Transfer & Protect Account
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomerResolution('proceeded')}
                            className="min-h-[44px] py-3 px-4 bg-[#FAF8F5] dark:bg-[#141418] border border-neutral-300 dark:border-neutral-700 hover:border-[#0A0A0A] dark:hover:border-white active:scale-[0.99] text-[#0A0A0A] dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                          >
                            Request Specialist Callback
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCustomerResolution('proceeded')}
                          className="min-h-[44px] w-full py-3 px-4 bg-[#0A0A0A] dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.99] text-white dark:text-[#0A0A0A] text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Send ${signalState.amountUsd.toLocaleString()} Instantly (Zero Friction)
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="min-h-[44px] flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800 text-xs">
                      <span className="font-semibold text-[#0A0A0A] dark:text-white">
                        {customerResolution === 'cancelled'
                          ? `Prevented $${signalState.amountUsd.toLocaleString()} scam — Payee flagged.`
                          : evaluation.recommendedFriction}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomerResolution('pending')}
                        className="min-h-[36px] px-2 text-[#C2410C] dark:text-[#FF7A00] font-bold underline cursor-pointer ml-3 shrink-0"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#09090B] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
              The interactive Fraud Simulator is currently paused. Enable it to test Authorized Push Payment and Remote Access scam scenarios against the live JSON engine.
            </p>
            <button
              type="button"
              onClick={() => setSimulatorOpen(true)}
              className="min-h-[44px] px-6 py-3 bg-[#FF5500] hover:bg-[#EA580C] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Launch Fraud Simulator
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
