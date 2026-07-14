/** Shared full-bleed atlas backdrop for title and end screens. */
export function AtlasBackdrop({ variant = 'default' }: { variant?: 'default' | 'victory' | 'defeat' }) {
  const uid = `atlas-${variant}`;
  return (
    <div className={`atlas-backdrop atlas-backdrop--${variant}`} aria-hidden="true">
      <svg className="atlas-grid" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`${uid}-globe`} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="rgba(180, 210, 200, 0.14)" />
            <stop offset="55%" stopColor="rgba(40, 90, 78, 0.08)" />
            <stop offset="100%" stopColor="rgba(8, 16, 14, 0)" />
          </radialGradient>
          <linearGradient id={`${uid}-land`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(196, 178, 138, 0.22)" />
            <stop offset="100%" stopColor="rgba(90, 140, 120, 0.12)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 13 }, (_, i) => {
          const x = 80 + i * 85;
          return (
            <line
              key={`m${i}`}
              x1={x}
              y1="40"
              x2={x}
              y2="760"
              stroke="rgba(180, 200, 190, 0.08)"
              strokeWidth="1"
            />
          );
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const y = 60 + i * 85;
          return (
            <line
              key={`p${i}`}
              x1="40"
              y1={y}
              x2="1160"
              y2={y}
              stroke="rgba(180, 200, 190, 0.07)"
              strokeWidth="1"
            />
          );
        })}
        <circle cx="600" cy="380" r="320" fill={`url(#${uid}-globe)`} />
        <circle
          cx="600"
          cy="380"
          r="318"
          fill="none"
          stroke="rgba(200, 220, 210, 0.12)"
          strokeWidth="1.5"
        />
        <path
          fill={`url(#${uid}-land)`}
          d="M310 250c40-50 110-70 170-55 55 12 95 55 130 75 40 24 95 20 120-10 30-35 85-40 120-15 40 28 55 85 35 125-18 36-70 55-105 40-45-18-70 15-55 55 20 55-15 110-70 125-60 16-120-20-145-75-20-42-70-55-110-40-55 20-115-10-140-60-28-55-5-120 50-165z"
        />
        <path
          fill={`url(#${uid}-land)`}
          d="M720 420c55-25 125-15 165 25 35 35 30 95-10 125-42 32-100 28-135-5-28-26-70-20-95 5-40 38-105 20-125-25-18-40 10-90 50-105 35-14 85-5 150-20z"
        />
        <path
          fill={`url(#${uid}-land)`}
          opacity="0.7"
          d="M780 220c45-20 95-5 110 35 12 30-5 65-35 75-40 14-85-5-95-40-8-28 5-55 20-70z"
        />
      </svg>
      <div className="atlas-vignette" />
    </div>
  );
}
