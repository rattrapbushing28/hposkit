export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hpos-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9b74c7" />
          <stop offset="0.5" stopColor="#7f54b3" />
          <stop offset="1" stopColor="#67498f" />
        </linearGradient>
        <linearGradient id="hpos-grad-light" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c084fc" />
          <stop offset="1" stopColor="#9b74c7" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="48" height="48" rx="12" fill="url(#hpos-grad)" />

      {/* Database cylinder — represents order storage tables */}
      <ellipse cx="24" cy="14" rx="11" ry="4" stroke="white" strokeWidth="2" strokeOpacity="0.9" fill="none" />
      <path d="M13 14 V24 C13 26.2 17.9 28 24 28 C30.1 28 35 26.2 35 24 V14" stroke="white" strokeWidth="2" strokeOpacity="0.9" fill="none" />
      <path d="M13 24 V34 C13 36.2 17.9 38 24 38 C30.1 38 35 36.2 35 34 V24" stroke="white" strokeWidth="2" strokeOpacity="0.9" fill="none" />

      {/* Lightning bolt — represents high performance */}
      <path
        d="M26 18 L20 27 H24 L22 34 L30 24 H26 L28 18 Z"
        fill="url(#hpos-grad-light)"
        stroke="white"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
