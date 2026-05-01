import { Logo } from "./Logo";

export function Wordmark({ size = 28, tone = "ink" }: { size?: number; tone?: "ink" | "cream" }) {
  const ink = tone === "cream" ? "#fbf6e9" : "#1a2b24";
  return (
    <span className="inline-flex items-center gap-2">
      <Logo size={size} tone={tone === "cream" ? "cream" : "ink"} />
      <span style={{
        fontFamily: "Fraunces, serif", fontWeight: 800, fontStyle: "italic",
        letterSpacing: "-0.02em", fontSize: size * 0.62, color: ink, lineHeight: 1,
      }}>
        localseat
        <span style={{
          display: "inline-block", width: size * 0.12, height: size * 0.12,
          borderRadius: 999, background: "#e8855c", marginLeft: 2,
        }} />
      </span>
    </span>
  );
}
