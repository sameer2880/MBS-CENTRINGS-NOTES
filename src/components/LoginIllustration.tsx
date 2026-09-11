/**
 * Decorative login-screen illustration: a construction worker in a hi-vis
 * vest and hard hat holding up a phone showing the login form — fits the
 * app's construction/centring-rental context better than a generic figure.
 * Colors are hardcoded (not `var(--color-*)`) on purpose — this is a
 * static decorative graphic on the signed-out screen, and CSS custom
 * properties don't reliably resolve inside every inline-SVG rendering
 * context, which previously left several shapes invisible. Every body
 * part is drawn with a few pixels of overlap into its neighbor (head into
 * neck into torso, upper arm into forearm into hand into phone) so the
 * figure always reads as one connected shape holding the device, never
 * floating pieces.
 */
export function LoginIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 260"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Illustration of a construction worker checking the login screen on a phone"
    >
      {/* soft background blobs */}
      <circle cx="212" cy="200" r="10" fill="#a8d977" opacity="0.25" />
      <circle cx="18" cy="60" r="8" fill="#4f7a3d" opacity="0.15" />

      {/* ground shadow */}
      <ellipse cx="120" cy="250" rx="65" ry="8" fill="#0f1a13" opacity="0.08" />

      {/* legs */}
      <rect x="100" y="190" width="16" height="50" rx="8" fill="#22324a" />
      <rect x="124" y="190" width="16" height="50" rx="8" fill="#2c3e5a" />
      {/* boots */}
      <ellipse cx="108" cy="241" rx="13" ry="6" fill="#1a1a1a" />
      <ellipse cx="132" cy="241" rx="13" ry="6" fill="#1a1a1a" />

      {/* hi-vis vest torso — overlaps down into the legs */}
      <rect x="92" y="120" width="56" height="76" rx="18" fill="#e8672c" />
      {/* reflective stripes */}
      <rect x="92" y="142" width="56" height="8" fill="#f4f4f4" />
      <rect x="92" y="162" width="56" height="8" fill="#f4f4f4" />

      {/* lower arm hanging at the side */}
      <rect x="78" y="128" width="16" height="55" rx="8" fill="#2f4a33" />
      <circle cx="86" cy="186" r="9" fill="#e6b894" />

      {/* raised arm holding the phone — forearm overlaps the upper arm at the elbow */}
      <rect x="140" y="118" width="42" height="16" rx="8" fill="#2f4a33" />
      <rect x="140" y="128" width="16" height="38" rx="8" fill="#2f4a33" />

      {/* neck — bridges head and torso */}
      <rect x="112" y="110" width="16" height="14" fill="#e6b894" />

      {/* head + hard hat, dome overlaps down onto the head */}
      <circle cx="120" cy="95" r="20" fill="#e6b894" />
      <ellipse cx="120" cy="90" rx="27" ry="6" fill="#e0ad2e" />
      <ellipse cx="120" cy="80" rx="24" ry="14" fill="#f2c14e" />

      {/* phone — its bottom overlaps the raised hand so it reads as held, not floating */}
      <rect x="147" y="30" width="70" height="110" rx="14" fill="#f5f7f0" stroke="#d7e2cd" strokeWidth="3" />
      <rect x="157" y="38" width="16" height="3" rx="1.5" fill="#d7e2cd" />
      <rect x="155" y="46" width="54" height="86" rx="8" fill="#eef2e6" />
      <circle cx="182" cy="62" r="8" fill="#4f7a3d" />
      <rect x="168" y="76" width="28" height="4" rx="2" fill="#223223" opacity="0.5" />
      <rect x="163" y="86" width="38" height="9" rx="4.5" fill="#dfe7d6" />
      <rect x="163" y="98" width="38" height="9" rx="4.5" fill="#dfe7d6" />
      <rect x="163" y="112" width="38" height="10" rx="5" fill="#a8d977" />

      {/* hand gripping the phone — drawn last so it sits on top of the phone's bottom edge */}
      <circle cx="182" cy="126" r="10" fill="#e6b894" />
    </svg>
  );
}