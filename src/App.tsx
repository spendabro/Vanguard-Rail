import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, Sun, Moon, Lock, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { InteractiveWorkbench } from './components/InteractiveWorkbench';
import { FaqSection } from './components/FaqSection';
import {
  AdminDashboard,
  FOUNDER_EMAIL,
  LOCAL_QUEUE_KEY,
  QueuedApiRequest,
} from './components/AdminDashboard';
import { auth, db } from './firebase';

const HERO_IMG = '/src/assets/images/hero_payment_security_1793364626590.jpg';
const CASE_NEOBANK_IMG = '/src/assets/images/case_study_neobank_1793364627995.jpg';
const CASE_CONSORTIUM_IMG = '/src/assets/images/case_study_consortium_1793364629239.jpg';

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        hash === '#admin' ||
        hash === '#founder' ||
        path.endsWith('/admin') ||
        path.endsWith('/founder') ||
        search.includes('admin')
      ) {
        return 'admin';
      }
    }
    return 'landing';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  // Theme State (Light vs High-Contrast SOC Dark Mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vanguardrail_theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  const [workEmail, setWorkEmail] = useState('');
  const [institutionInput, setInstitutionInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('vanguardrail_theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const isFounder =
    !!currentUser &&
    currentUser.emailVerified &&
    currentUser.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase();

  useEffect(() => {
    const syncUrlToMode = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        hash === '#admin' ||
        hash === '#founder' ||
        path.endsWith('/admin') ||
        path.endsWith('/founder') ||
        search.includes('admin')
      ) {
        setViewMode('admin');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('hashchange', syncUrlToMode);
    window.addEventListener('popstate', syncUrlToMode);
    return () => {
      window.removeEventListener('hashchange', syncUrlToMode);
      window.removeEventListener('popstate', syncUrlToMode);
    };
  }, []);

  const toggleFounderPortal = () => {
    setViewMode((prev) => {
      const next = prev === 'admin' ? 'landing' : 'admin';
      if (typeof window !== 'undefined') {
        window.location.hash = next === 'admin' ? 'admin' : '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handlePilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(workEmail.trim())) {
      setFormError('Please enter a valid work email address.');
      return;
    }
    setFormError('');

    const cleanEmail = workEmail.trim().slice(0, 160);
    const cleanInst = (
      institutionInput.trim() ||
      cleanEmail.split('@')[1] ||
      'Partner Institution'
    ).slice(0, 120);
    const entryId = `lead_${Date.now()}`;

    if (currentUser) {
      try {
        await setDoc(doc(db, 'entries', entryId), {
          entryType: 'api_access_request',
          email: cleanEmail,
          institution: cleanInst,
          scenarioName: 'Instant Payment Rail API Sandbox',
          amountUsd: 25000,
          riskScore: 12,
          decision: 'APPROVE',
          status: 'new',
          notes: 'Submitted via Landing Page API Access form.',
          authorUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Fallback to local queue for Founder sync
        const existingQueue: QueuedApiRequest[] = JSON.parse(
          localStorage.getItem(LOCAL_QUEUE_KEY) || '[]'
        );
        existingQueue.push({
          id: entryId,
          email: cleanEmail,
          institution: cleanInst,
          scenarioName: 'Instant Payment Rail API Sandbox',
          createdAtIso: new Date().toISOString(),
        });
        localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(existingQueue));
      }
    } else {
      // Queue locally without forcing public visitors to sign in; syncs automatically when Founder opens console
      const existingQueue: QueuedApiRequest[] = JSON.parse(
        localStorage.getItem(LOCAL_QUEUE_KEY) || '[]'
      );
      existingQueue.push({
        id: entryId,
        email: cleanEmail,
        institution: cleanInst,
        scenarioName: 'Instant Payment Rail API Sandbox',
        createdAtIso: new Date().toISOString(),
      });
      localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(existingQueue));
    }

    setFormSubmitted(true);
  };

  const scrollToSection = (id: string) => {
    if (viewMode !== 'landing') {
      setViewMode('landing');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090B] text-[#0A0A0A] dark:text-[#FAFAFA] flex flex-col transition-colors">
      {/* PRIVATE FOUNDER BAR — Visible ONLY when authenticated as the Founder (ajanakuayomide0@gmail.com) */}
      {isFounder && (
        <div className="bg-[#0A0A0A] dark:bg-[#18181C] text-white border-b border-neutral-800 px-4 sm:px-6 py-2 text-xs">
          <div className="max-w-[1160px] mx-auto flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 font-mono text-orange-300 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
              Founder Authenticated ({currentUser?.email})
            </span>
            <button
              type="button"
              onClick={toggleFounderPortal}
              className="px-3 py-1 rounded-md bg-[#FF5500] hover:bg-[#EA580C] text-white font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {viewMode === 'admin' ? 'Return to Public Site' : 'Open Founder Console'}
            </button>
          </div>
        </div>
      )}

      {/* STRICT 3-ZONE TOP BAR CONTRACT (No public Admin links) */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-[1160px] mx-auto flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 h-14">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setViewMode('landing');
            }}
            className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0A0A0A] dark:text-white whitespace-nowrap shrink-0 font-display"
          >
            Vanguard<span className="text-[#FF5500]">Rail</span>
          </a>

          {/* Zone 2: 4 clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            <a
              href="#capabilities"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('capabilities');
              }}
              className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#risk-engine"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('risk-engine');
              }}
              className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Live Sandbox
            </a>
            <a
              href="#case-studies"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('case-studies');
              }}
              className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Case Studies
            </a>
            <a
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('faq');
              }}
              className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => scrollToSection('risk-engine')}
              className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-[#0A0A0A] dark:bg-[#FF5500] hover:bg-[#FF5500] dark:hover:bg-[#EA580C] active:scale-[0.98] rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Fraud Simulator
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Mobile Quick-Jump & Theme Bar */}
        <div className="md:hidden bg-[#FAF8F5] dark:bg-[#121215] border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollToSection('capabilities')}
              className="min-h-[40px] px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-[#18181C] border border-neutral-200 dark:border-neutral-800 rounded-lg whitespace-nowrap shrink-0"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('risk-engine')}
              className="min-h-[40px] px-3 py-2 text-xs font-semibold text-white bg-[#FF5500] rounded-lg whitespace-nowrap shrink-0"
            >
              Simulator
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="min-h-[40px] px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-[#18181C] border border-neutral-200 dark:border-neutral-800 rounded-lg whitespace-nowrap shrink-0"
            >
              FAQ
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle SOC Dark Mode"
            className="min-h-[40px] px-3 py-2 text-xs font-bold text-[#0A0A0A] dark:text-white bg-white dark:bg-[#18181C] border border-neutral-200 dark:border-neutral-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#FF7A00]" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#FF5500]" />
                SOC Dark
              </>
            )}
          </button>
        </div>

        {viewMode === 'admin' ? (
          <AdminDashboard
            currentUser={currentUser}
            isAuthReady={isAuthReady}
            onBackToSite={() => setViewMode('landing')}
          />
        ) : (
          <>
            {/* 1. CLEAN, SPACIOUS HERO SECTION */}
            <section className="bg-solar-mesh py-14 sm:py-24 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
              <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
                {/* SOC Display Mode Utility Bar */}
                <div className="hidden md:flex items-center justify-between pb-8 mb-8 border-b border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <span className="text-[#C2410C] dark:text-[#FF7A00] font-semibold">
                      Real-Time APP Fraud API
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Sub-40ms Scoring</span>
                    <span aria-hidden="true">·</span>
                    <span>Zero-PII Consortium</span>
                  </div>

                  {/* Theme Switcher for SOC Environments */}
                  <div className="flex items-center gap-1 p-1 bg-neutral-200/70 dark:bg-[#18181C] border border-neutral-300/60 dark:border-neutral-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        theme === 'light'
                          ? 'bg-white text-[#0A0A0A] shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0A0A0A] dark:hover:text-white'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-[#FF5500]" />
                      Light Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        theme === 'dark'
                          ? 'bg-[#09090B] text-white border border-neutral-700 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0A0A0A] dark:hover:text-white'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-[#FF7A00]" />
                      SOC Dark Mode
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                  <div className="lg:col-span-7">
                    <div className="md:hidden flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-4">
                      <span className="text-[#C2410C] dark:text-[#FF7A00] font-semibold">
                        Real-Time APP Fraud API
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Sub-40ms Scoring</span>
                    </div>

                    <h1
                      className="font-display font-extrabold tracking-tight text-[#0A0A0A] dark:text-white leading-[1.1] mb-5"
                      style={{ fontSize: 'clamp(2rem, 4vw, 3.6rem)', textWrap: 'balance' }}
                    >
                      Stop Social-Engineering Payments{' '}
                      <span className="text-gradient-orange-black">
                        Before the Money Leaves.
                      </span>
                    </h1>

                    <p className="text-sm sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl mb-8">
                      Authentication cannot stop fraud when the real customer is tricked into authorizing the transfer. VanguardRail detects live coercion, payee velocity, and mule networks via a single API—applying precise friction only when it matters.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => scrollToSection('risk-engine')}
                        className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-[#FF5500] to-[#C2410C] hover:from-[#EA580C] hover:to-[#9A3412] active:scale-[0.99] rounded-xl transition-all cursor-pointer whitespace-nowrap"
                      >
                        Launch Fraud Simulator
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <a
                        href="#pilot-access"
                        className="min-h-[48px] inline-flex items-center justify-center px-5 py-3.5 text-sm font-semibold text-[#0A0A0A] dark:text-white bg-white dark:bg-[#18181C] border border-neutral-300 dark:border-neutral-700 hover:border-[#0A0A0A] dark:hover:border-white active:scale-[0.99] rounded-xl transition-all whitespace-nowrap"
                      >
                        Request API Keys
                      </a>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-[#0A0A0A] relative aspect-16/10 lg:aspect-4/3">
                      <img
                        src={HERO_IMG}
                        alt="Optical glass interception prism representing real-time APP payment protection"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-5 sm:p-6 text-white">
                        <div className="text-xs font-mono text-[#FF7A00] mb-1">
                          POST /v1/payments/score · 36ms
                        </div>
                        <div className="text-sm font-bold">
                          “Safe Account” Scam Intercepted — $24,500 Held
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quiet 3-Metric Strip */}
                <div className="mt-12 sm:mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                  <div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-[#0A0A0A] dark:text-white">
                      $15.9B
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Annual U.S. consumer fraud losses driven by authorized push transfers
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-[#0A0A0A] dark:text-white">
                      38ms
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      p99 scoring latency across behavioral, device, and consortium signals
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-[#0A0A0A] dark:text-white">
                      99.65%
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Legitimate instant payments approved with zero added friction
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. THREE CORE CAPABILITIES */}
            <section id="capabilities" className="py-16 sm:py-24 bg-white dark:bg-[#09090B] transition-colors">
              <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
                <div className="max-w-2xl mb-10 sm:mb-14">
                  <p className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] tracking-wide mb-2">
                    Core Architecture
                  </p>
                  <h2
                    className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0A0A0A] dark:text-white"
                    style={{ textWrap: 'balance' }}
                  >
                    Built for the Moment the Customer{' '}
                    <span className="text-gradient-solar">Authorizes the Transfer</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
                  <div className="pt-5 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs font-mono font-bold text-[#FF5500] mb-2">01</div>
                    <h3 className="text-lg font-bold text-[#0A0A0A] dark:text-white mb-2">
                      Multi-Signal Risk Engine
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Scores customer behavioral baselines alongside active phone calls, remote desktop tools, pasted payee details, and sudden limit increases in real time.
                    </p>
                  </div>

                  <div className="pt-5 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs font-mono font-bold text-[#FF5500] mb-2">02</div>
                    <h3 className="text-lg font-bold text-[#0A0A0A] dark:text-white mb-2">
                      Context-Aware Intervention
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Replaces ignored generic banners with specific scam warnings (“Banks never ask you to move money to a safe account”), 24-hour holds, and callback verification.
                    </p>
                  </div>

                  <div className="pt-5 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs font-mono font-bold text-[#FF5500] mb-2">03</div>
                    <h3 className="text-lg font-bold text-[#0A0A0A] dark:text-white mb-2">
                      Consortium Mule Intelligence
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Flags newly opened receiving accounts collecting rapid inbound transfers from unrelated senders across partner banks before funds disperse.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. LIVE SANDBOX WITH TOGGLEABLE FRAUD SIMULATOR */}
            <InteractiveWorkbench />

            {/* 4. CASE STUDIES */}
            <section
              id="case-studies"
              className="py-16 sm:py-24 bg-white dark:bg-[#09090B] border-b border-neutral-200 dark:border-neutral-800 transition-colors"
            >
              <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
                <div className="max-w-2xl mb-10 sm:mb-12">
                  <p className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] tracking-wide mb-2">
                    Proven Outcomes
                  </p>
                  <h2
                    className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0A0A0A] dark:text-white"
                    style={{ textWrap: 'balance' }}
                  >
                    Trusted by Digital Banks &{' '}
                    <span className="text-gradient-orange-black">Instant Payment Rails</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#121215]">
                    <div className="h-48 sm:h-52 bg-neutral-900 overflow-hidden">
                      <img
                        src={CASE_NEOBANK_IMG}
                        alt="European digital bank headquarters atrium"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-6 sm:p-8">
                      <div className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] mb-2">
                        UK Tier-2 Digital Bank · 4.2M Customers
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-[#0A0A0A] dark:text-white mb-2">
                        -68% Net APP Impersonation Losses in 90 Days
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
                        Prevented £14.2M in mandatory PSR reimbursements by combining active call + screen-share detection with a 24-hour cooling-off hold.
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        — Alistair Finch, Head of Payment Risk, Sterling Digital Bank
                      </p>
                    </div>
                  </article>

                  <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#121215]">
                    <div className="h-48 sm:h-52 bg-neutral-900 overflow-hidden">
                      <img
                        src={CASE_CONSORTIUM_IMG}
                        alt="Optical consortium network nodes"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-6 sm:p-8">
                      <div className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] mb-2">
                        U.S. Treasury Processor · $42B FedNow/RTP Volume
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-[#0A0A0A] dark:text-white mb-2">
                        $9.4M Saved in AI Voice-Clone Supplier Redirects
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
                        Flagged 410 newly opened mule accounts across 38 sponsor banks before rapid outbound crypto dispersal could execute.
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        — Elena Rostova, VP of Real-Time Clearing, Meridian Rails
                      </p>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            {/* 5. FREQUENTLY ASKED QUESTIONS */}
            <FaqSection />

            {/* 6. MINIMALIST API SANDBOX ACCESS CTA */}
            <section
              id="pilot-access"
              className="py-16 sm:py-20 bg-[#FAF8F5] dark:bg-[#121215] transition-colors"
            >
              <div className="max-w-[960px] mx-auto px-4 sm:px-6">
                <div className="bg-[#0A0A0A] dark:bg-[#18181C] border border-transparent dark:border-neutral-800 text-white rounded-2xl p-6 sm:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8">
                  <div className="max-w-md">
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-2">
                      Deploy in Shadow Mode in 48 Hours
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                      Get the OpenAPI specification, SDK docs, and outcome-based pricing sheet for your fraud and payments team.
                    </p>
                  </div>

                  <div className="w-full md:w-auto md:min-w-[360px]">
                    {formSubmitted ? (
                      <div className="p-4 rounded-xl bg-white/10 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-[#FF7A00] font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          API Request Received
                        </div>
                        <p className="text-neutral-300">
                          We have registered <span className="font-mono text-white">{workEmail}</span>. Our team will dispatch your sandbox credentials shortly.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handlePilotSubmit} className="space-y-2.5" noValidate>
                        <input
                          type="text"
                          placeholder="Institution Name (e.g., Horizon Bank)"
                          value={institutionInput}
                          onChange={(e) => setInstitutionInput(e.target.value)}
                          className="min-h-[44px] w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-neutral-400 rounded-xl focus:outline-none focus:border-[#FF5500]"
                        />
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <input
                            type="email"
                            placeholder="you@bank-or-fintech.com"
                            value={workEmail}
                            onChange={(e) => setWorkEmail(e.target.value)}
                            className="min-h-[44px] flex-1 px-4 py-3 text-sm bg-white text-[#0A0A0A] rounded-xl focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="min-h-[44px] px-5 py-3 text-xs font-bold text-white bg-[#FF5500] hover:bg-[#EA580C] active:scale-[0.99] rounded-xl transition-all cursor-pointer whitespace-nowrap"
                          >
                            Get API Access
                          </button>
                        </div>
                        {formError && <p className="text-xs text-[#FF7A00]">{formError}</p>}
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* QUIET FOOTER WITH THEME TOGGLE & DISCREET FOUNDER LOCK */}
      <footer className="bg-white dark:bg-[#09090B] border-t border-neutral-200 dark:border-neutral-800 py-8 transition-colors">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <div>
            <span className="font-display font-extrabold text-sm text-[#0A0A0A] dark:text-white">
              Vanguard<span className="text-[#FF5500]">Rail</span>
            </span>{' '}
            · Real-Time APP Scam Intervention API
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={toggleTheme}
              className="hover:text-[#0A0A0A] dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FF7A00]" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#FF5500]" />
                  SOC Dark Mode
                </>
              )}
            </button>

            <span>© {new Date().getFullYear()} VanguardRail Inc.</span>

            {/* Founder-Only Portal Trigger (Protected by Google Auth for ajanakuayomide0@gmail.com) */}
            <button
              type="button"
              onClick={toggleFounderPortal}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-[#FF5500] text-[#0A0A0A] dark:text-neutral-200 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#FF5500]" />
              {viewMode === 'admin' ? 'Exit Founder Portal' : 'Founder Portal'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
