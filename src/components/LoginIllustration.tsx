import { useId } from "react";

/**
 * Decorative login-screen illustration: a construction worker in a hi-vis
 * vest and hard hat holding up a phone that shows a miniature dashboard
 * screenshot — stat cards, a bar chart, a bottom nav row — echoing the
 * app's actual Dashboard page instead of a few abstract rectangles.
 *
 * Colors are hardcoded (not `var(--color-*)`) on purpose — this is a
 * static decorative graphic on the signed-out screen, and CSS custom
 * properties don't reliably resolve inside every inline-SVG rendering
 * context, which previously left several shapes invisible. Gradients are
 * used for the skin/vest/hat/pants/phone/bars so the figure and screen
 * read as shaded and three-dimensional rather than flat cut-out shapes.
 * Every body part is drawn with a few pixels of overlap into its neighbor
 * (head into neck into torso, upper arm into forearm into hand into
 * phone) so the figure always reads as one connected shape holding the
 * device, never floating pieces.
 *
 * Gradient ids are namespaced per render with `useId()` rather than
 * hardcoded. The sign-in screen mounts this component twice at once (a
 * desktop copy inside a `hidden lg:flex` panel, plus a mobile copy) — two
 * `<svg>`s with identical id="li-skin" etc. is invalid HTML, and browsers
 * resolve `url(#li-skin)` to whichever one is first in the DOM. When that
 * first copy sits inside a `display:none` ancestor, engines commonly
 * refuse to paint the gradient anywhere on the page, silently dropping
 * the skin/hat/sleeve/pants fills. Unique ids per instance side-step this
 * entirely, whether the component is used once or many times on a page.
 */
export function LoginIllustration({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `li-${uid}-${name}`;

  return (
    <svg
      viewBox="0 0 240 260"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Illustration of a construction worker checking a dashboard on a phone"
    >
      <defs>
        <linearGradient id={id("skin")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0c9a2" />
          <stop offset="100%" stopColor="#e0ac81" />
        </linearGradient>
        <linearGradient id={id("vest")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0812f" />
          <stop offset="100%" stopColor="#d85a1a" />
        </linearGradient>
        <linearGradient id={id("pants")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#33455f" />
          <stop offset="100%" stopColor="#212f42" />
        </linearGradient>
        <linearGradient id={id("hat")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7d066" />
          <stop offset="100%" stopColor="#e0ad2e" />
        </linearGradient>
        <linearGradient id={id("sleeve")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3c5c41" />
          <stop offset="100%" stopColor="#2a4030" />
        </linearGradient>
        <linearGradient id={id("phone")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2ea" />
        </linearGradient>
        <linearGradient id={id("bar")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4f7a3d" />
          <stop offset="100%" stopColor="#8fc45f" />
        </linearGradient>
        <radialGradient id={id("ground")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0f1a13" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0f1a13" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft background blobs */}
      <circle cx="214" cy="196" r="12" fill="#a8d977" opacity="0.22" />
      <circle cx="16" cy="56" r="9" fill="#4f7a3d" opacity="0.15" />
      <circle cx="30" cy="150" r="5" fill="#e0812f" opacity="0.18" />
      <circle cx="200" cy="40" r="6" fill="#4f7a3d" opacity="0.15" />

      {/* ground shadow */}
      <ellipse cx="118" cy="250" rx="70" ry="9" fill={`url(#${id("ground")})`} />

      {/* legs */}
      <rect x="99" y="188" width="17" height="52" rx="8.5" fill={`url(#${id("pants")})`} />
      <rect x="124" y="188" width="17" height="52" rx="8.5" fill={`url(#${id("pants")})`} />
      <rect x="99" y="188" width="17" height="10" rx="6" fill="#0f1a13" opacity="0.18" />
      <rect x="124" y="188" width="17" height="10" rx="6" fill="#0f1a13" opacity="0.18" />
      {/* boots */}
      <ellipse cx="107" cy="241" rx="14" ry="6.5" fill="#171717" />
      <ellipse cx="132" cy="241" rx="14" ry="6.5" fill="#171717" />
      <ellipse cx="103" cy="238.5" rx="5" ry="2" fill="#3a3a3a" opacity="0.7" />
      <ellipse cx="128" cy="238.5" rx="5" ry="2" fill="#3a3a3a" opacity="0.7" />

      {/* hi-vis vest torso — overlaps down into the legs */}
      <rect x="90" y="118" width="58" height="78" rx="19" fill={`url(#${id("vest")})`} />
      {/* belt */}
      <rect x="90" y="188" width="58" height="9" rx="3" fill="#22324a" opacity="0.85" />
      {/* reflective stripes */}
      <rect x="90" y="140" width="58" height="8" fill="#f7f9f4" />
      <rect x="90" y="160" width="58" height="8" fill="#f7f9f4" />
      {/* chest pocket */}
      <rect x="98" y="150" width="16" height="12" rx="2.5" fill="#c94e13" opacity="0.8" />
      {/* vest highlight */}
      <path d="M96 120 q-4 30 0 68" stroke="#ffb27a" strokeWidth="4" opacity="0.35" fill="none" strokeLinecap="round" />

      {/* lower arm hanging at the side, hand resting near hip */}
      <rect x="76" y="126" width="17" height="56" rx="8.5" fill={`url(#${id("sleeve")})`} />
      <circle cx="84" cy="187" r="9.5" fill={`url(#${id("skin")})`} />

      {/* raised arm holding the phone — forearm overlaps the upper arm at the elbow */}
      <rect x="139" y="116" width="44" height="17" rx="8.5" fill={`url(#${id("sleeve")})`} />
      <rect x="139" y="127" width="17" height="40" rx="8.5" fill={`url(#${id("sleeve")})`} />
      {/* sleeve cuff */}
      <rect x="139" y="160" width="17" height="7" rx="3.5" fill="#22324a" opacity="0.5" />

      {/* neck — bridges head and torso */}
      <rect x="111" y="108" width="17" height="15" fill={`url(#${id("skin")})`} />
      <rect x="111" y="116" width="17" height="7" fill="#c99368" opacity="0.5" />

      {/* head + hard hat, dome overlaps down onto the head */}
      <circle cx="119" cy="94" r="21" fill={`url(#${id("skin")})`} />
      {/* ear */}
      <circle cx="98" cy="95" r="4.5" fill="#e0ac81" />
      {/* subtle chin shading */}
      <path d="M108 106 q11 8 22 0" stroke="#c99368" strokeWidth="2.5" opacity="0.4" fill="none" strokeLinecap="round" />
      {/* hard hat brim + dome */}
      <ellipse cx="119" cy="89" rx="28" ry="6.5" fill="#c98f1f" />
      <ellipse cx="119" cy="78" rx="25" ry="15" fill={`url(#${id("hat")})`} />
      <path d="M97 78 q22 -10 44 0" stroke="#fce8a8" strokeWidth="2.5" opacity="0.6" fill="none" strokeLinecap="round" />
      <rect x="112" y="66" width="14" height="4" rx="2" fill="#c98f1f" opacity="0.7" />

      {/* phone — its bottom overlaps the raised hand so it reads as held, not floating */}
      <rect x="146" y="26" width="72" height="114" rx="15" fill="#293040" />
      <rect x="149" y="29" width="66" height="108" rx="12" fill={`url(#${id("phone")})`} stroke="#d7e2cd" strokeWidth="1.5" />
      {/* speaker notch */}
      <rect x="174" y="34" width="16" height="3" rx="1.5" fill="#c7d3bd" />

      {/* ---- mini "dashboard" screenshot on the phone screen ---- */}
      {/* top app bar */}
      <circle cx="159" cy="46" r="4.5" fill="#4f7a3d" />
      <rect x="167" y="43.5" width="30" height="5" rx="2.5" fill="#2a3a2a" opacity="0.55" />

      {/* 2x2 stat cards */}
      <rect x="155" y="55" width="26" height="20" rx="4" fill="#eaf3e2" />
      <circle cx="161" cy="61.5" r="3" fill="#4f7a3d" />
      <rect x="159" y="67" width="14" height="4.5" rx="2" fill="#3c4a3c" opacity="0.55" />

      <rect x="185" y="55" width="26" height="20" rx="4" fill="#fdecdd" />
      <circle cx="191" cy="61.5" r="3" fill="#d5701f" />
      <rect x="189" y="67" width="14" height="4.5" rx="2" fill="#5a4433" opacity="0.55" />

      <rect x="155" y="79" width="26" height="20" rx="4" fill="#e7eefb" />
      <circle cx="161" cy="85.5" r="3" fill="#3b6ea5" />
      <rect x="159" y="91" width="14" height="4.5" rx="2" fill="#33475a" opacity="0.55" />

      <rect x="185" y="79" width="26" height="20" rx="4" fill="#fdeaea" />
      <circle cx="191" cy="85.5" r="3" fill="#c74b4b" />
      <rect x="189" y="91" width="14" height="4.5" rx="2" fill="#5a3333" opacity="0.55" />

      {/* mini bar chart */}
      <rect x="155" y="103" width="56" height="27" rx="4" fill="#f4f7ef" />
      <rect x="161" y="117" width="6" height="9" rx="1.5" fill={`url(#${id("bar")})`} />
      <rect x="171" y="111" width="6" height="15" rx="1.5" fill={`url(#${id("bar")})`} />
      <rect x="181" y="107" width="6" height="19" rx="1.5" fill={`url(#${id("bar")})`} />
      <rect x="191" y="114" width="6" height="12" rx="1.5" fill={`url(#${id("bar")})`} />
      <rect x="201" y="109" width="6" height="17" rx="1.5" fill={`url(#${id("bar")})`} />
    </svg>
  );
}