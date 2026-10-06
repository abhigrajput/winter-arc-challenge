/**
 * Fallback snow: three layers of radial-gradient dots drifting down. Pure CSS,
 * compositor-only (transform), and static under reduced motion.
 */
export function CssSnow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="wa-snow wa-snow-far" />
      <div className="wa-snow wa-snow-mid" />
      <div className="wa-snow wa-snow-near" />
    </div>
  );
}
