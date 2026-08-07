"use client";

const PAYPAL_URL = "https://www.paypal.com/paypalme/rynald0s";

export function DonateButton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href={PAYPAL_URL}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass glass-hover text-xs font-medium text-gray-300 hover:text-wc-purpleLight transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        Donate
      </a>
    );
  }

  return (
    <a
      href={PAYPAL_URL}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-sm font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      Support rynald0s
    </a>
  );
}
