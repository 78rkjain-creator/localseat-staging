type Variant = "full" | "mono" | "favicon";
type Tone = "ink" | "cream" | "clay";

const TONE = {
  ink:   { bubble: "#1a2b24", body: "#fbf6e9", accent: "#e8855c" },
  cream: { bubble: "#fbf6e9", body: "#1a2b24", accent: "#e8855c" },
  clay:  { bubble: "#e8855c", body: "#fbf6e9", accent: "#fbf6e9" },
};

export function Logo({
  size = 32, variant = "full", tone = "ink", title = "Local Seat",
}: { size?: number; variant?: Variant; tone?: Tone; title?: string }) {
  const t = TONE[tone];
  if (variant === "favicon") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title}>
        <rect width="32" height="32" rx="6" fill={t.bubble}/>
        <path d="M11 17 L15 21 L22 12" stroke={t.accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={title}>
      <path d="M8 10 H48 Q52 10 52 14 V36 Q52 40 48 40 H32 L22 50 L22 40 H8 Q4 40 4 36 V14 Q4 10 8 10 Z" fill={t.bubble}/>
      {variant === "full" && (<>
        <line x1="14" y1="20" x2="42" y2="20" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="14" y1="26" x2="36" y2="26" stroke={t.body} strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
        <line x1="14" y1="32" x2="20" y2="32" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"/>
      </>)}
      <path d="M22 28 L26 32 L34 24" stroke={t.accent} strokeWidth={variant === "mono" ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
