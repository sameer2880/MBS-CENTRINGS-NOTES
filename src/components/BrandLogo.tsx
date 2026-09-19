import type { CSSProperties } from "react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

/**
 * The M.B.S logo, cropped to a circle with a green ring around it.
 *
 * Every place the logo appears uses this component, so the ring and the motion
 * always match. The styles live in `styles.css` under "Brand logo".
 *
 *  - Ring:       a circular border in the brand green (thickness = `ringWidth`)
 *  - Animation:  a light "chase" that slowly circles the ring, a soft pulsing
 *                glow, a pop-in when it first appears, and a small zoom on hover
 *  - `animated={false}` gives a plain static ring (used on the printed receipt)
 *
 * Size it with Tailwind classes, e.g. `className="h-9 w-9"`.
 */
export function BrandLogo({
  className,
  alt = "",
  animated = true,
  ringWidth = 2,
}: {
  className?: string;
  alt?: string;
  animated?: boolean;
  /** Ring thickness in px. Use 2 for small logos, 3-4 for large ones. */
  ringWidth?: number;
}) {
  return (
    <span
      className={cn("brand-logo", animated && "brand-logo-animated", className)}
      style={{ "--brand-ring-w": `${ringWidth}px` } as CSSProperties}
    >
      <img src={logo} alt={alt} draggable={false} className="brand-logo-img" />
    </span>
  );
}