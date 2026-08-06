"use client";

import { useState } from "react";

const PAYPAL_BASE = "https://www.paypal.com/paypalme/rynald0s";

export function DonateButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const donateUrl = (amount?: number) => {
    return amount ? `${PAYPAL_BASE}/${amount}` : PAYPAL_BASE;
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass glass-hover text-xs font-medium text-gray-300"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Donate
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <DonatePanel
              customAmount={customAmount}
              setCustomAmount={setCustomAmount}
              donateUrl={donateUrl}
              onClose={() => setOpen(false)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-sm font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        Support rynald0s
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <DonatePanel
            customAmount={customAmount}
            setCustomAmount={setCustomAmount}
            donateUrl={donateUrl}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function DonatePanel({
  customAmount,
  setCustomAmount,
  donateUrl,
  onClose,
}: {
  customAmount: string;
  setCustomAmount: (v: string) => void;
  donateUrl: (amount?: number) => string;
  onClose: () => void;
}) {
  const presets = [5, 10, 25];
  const customNum = parseFloat(customAmount) || 0;

  return (
    <div className="absolute right-0 top-full mt-2 z-30 w-64 glass rounded-xl p-4 shadow-2xl shadow-black/40 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-300">Support rynald0s</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {presets.map((amt) => (
          <a
            key={amt}
            href={donateUrl(amt)}
            target="_blank"
            rel="noopener"
            className="text-center py-2 rounded-lg bg-white/5 hover:bg-wc-purple/20 text-xs font-medium text-gray-300 hover:text-white transition-all border border-white/5 hover:border-wc-purple/30"
          >
            ${amt}
          </a>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Custom"
            className="w-full pl-6 pr-2 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-wc-purple/40 transition-colors"
          />
        </div>
        <a
          href={customNum > 0 ? donateUrl(customNum) : donateUrl()}
          target="_blank"
          rel="noopener"
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            customNum > 0
              ? "bg-gradient-to-r from-wc-purple to-purple-500 text-white hover:from-wc-purpleDark hover:to-purple-600"
              : "bg-white/5 text-gray-600 cursor-not-allowed"
          }`}
        >
          Go
        </a>
      </div>

      <p className="text-[10px] text-gray-600 mt-3 text-center">Opens PayPal.me — no account needed</p>
    </div>
  );
}
