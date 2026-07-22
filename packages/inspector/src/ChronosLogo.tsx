// Exact Chronos Layered Sphere Graphic Logo (from design specification).
import type { SVGProps } from "react";

export function ChronosLogo({ size = 40, className = "" }: { size?: number; className?: string } & SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`chronos-logo-graphic ${className}`}
    >
      {/* 9 Layered Horizontal Bars creating 3D Sphere Geometry */}
      <rect x="30" y="10" width="40" height="6" rx="3" fill="currentColor" />
      <rect x="20" y="20" width="60" height="6" rx="3" fill="currentColor" />
      
      {/* Bar 3 (Top Groove) */}
      <path d="M 12 30 H 38 Q 48 30 50 34 Q 52 30 62 30 H 88 V 36 H 12 Z" fill="currentColor" />
      
      {/* Bar 4 */}
      <path d="M 8 40 H 34 Q 44 40 46 44 Q 48 40 58 40 H 92 V 46 H 8 Z" fill="currentColor" />
      
      {/* Center Bar 5 */}
      <path d="M 6 50 H 28 Q 38 50 40 54 Q 42 50 52 50 H 94 V 56 H 6 Z" fill="currentColor" />
      
      {/* Bar 6 */}
      <path d="M 8 60 H 34 Q 44 60 46 64 Q 48 60 58 60 H 92 V 66 H 8 Z" fill="currentColor" />
      
      {/* Bar 7 (Bottom Groove) */}
      <path d="M 12 70 H 38 Q 48 70 50 74 Q 52 70 62 70 H 88 V 76 H 12 Z" fill="currentColor" />
      
      <rect x="20" y="80" width="60" height="6" rx="3" fill="currentColor" />
      <rect x="30" y="90" width="40" height="6" rx="3" fill="currentColor" />
    </svg>
  );
}
