import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  id: string;
  topic: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-privacy',
    topic: 'Data Privacy & GDPR',
    question:
      'How does VanguardRail detect active phone calls and screen-sharing without violating user privacy?',
    answer:
      'Our SDK only checks OS-level boolean state flags (whether a cellular/VoIP audio channel or remote display driver like AnyDesk is active during the payment flow). It never records audio, captures screenshots, or logs raw keystrokes, complying fully with GDPR Article 6(1)(f) and CCPA fraud-prevention exemptions.',
  },
  {
    id: 'faq-consortium',
    topic: 'Cross-Bank Data Sharing Compliance',
    question:
      'How can banks share receiving-side mule intelligence without exposing customer PII?',
    answer:
      'Participating banks exchange salted cryptographic hashes (HMAC-SHA256) and directional velocity counts—never plaintext names or account balances. If a newly opened account receives 14 transfers from unrelated senders across 4 banks in 24 hours, that risk signal is shared under US PATRIOT Act Section 314(b), UK ECCTA 2023, and EU PSR safe-harbor rules.',
  },
  {
    id: 'faq-latency',
    topic: 'Latency Overhead & Instant Rail SLAs',
    question:
      'Will real-time multi-signal scoring slow down instant rails like FedNow, RTP, or Faster Payments?',
    answer:
      'No. Customer behavioral baselines and 2-hop mule graphs are pre-computed in a stateful Apache Flink feature store. Live scoring executes in 38ms (p99) with a hard 60ms circuit-breaker so legitimate instant transfers never stall.',
  },
  {
    id: 'faq-holds',
    topic: 'Regulatory Holds & Explainability',
    question:
      'Are banks legally allowed to place a 24-hour cooling-off hold on an authorized payment?',
    answer:
      'Yes. Both the UK PSR reimbursement framework and EU/US payment rules allow temporary protective holds when specific social-engineering indicators are documented. Every API response includes auditable reason codes to substantiate the hold.',
  },
];

export const FaqSection: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('faq-privacy');

  return (
    <section
      id="faq"
      className="py-16 sm:py-24 bg-white dark:bg-[#09090B] border-b border-neutral-200 dark:border-neutral-800 transition-colors"
    >
      <div className="max-w-[920px] mx-auto px-4 sm:px-6">
        <div className="mb-10">
          <p className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] tracking-wide mb-2">
            Regulatory & Technical FAQ
          </p>
          <h2
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0A0A0A] dark:text-white"
            style={{ textWrap: 'balance' }}
          >
            Privacy, Cross-Bank Compliance{' '}
            <span className="text-gradient-orange-black">& Latency Overhead</span>
          </h2>
        </div>

        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="w-full py-6 text-left flex items-start justify-between gap-6 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#C2410C] dark:text-[#FF7A00] mb-1">
                      {item.topic}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#0A0A0A] dark:text-white leading-snug">
                      {item.question}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-neutral-500 dark:text-neutral-400 shrink-0 mt-1 transition-transform duration-150 ${
                      isOpen ? 'rotate-180 text-[#FF5500]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="pb-6 pr-8">
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
