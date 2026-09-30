import type { SVGProps } from 'react';

// @radix-ui/react-icons has no literal gift icon; this fills that gap in the
// same 15x15 outline style so it matches the rest of the icon set visually.
export function GiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="2" y="6.5" width="11" height="6.5" rx="0.5" />
      <rect x="1.5" y="4" width="12" height="2.5" rx="0.5" />
      <line x1="7.5" y1="4" x2="7.5" y2="13" />
      <path d="M7.5 4C6.5 2 4 2 4 3.7c0 1 1.5 1 3.5.3Z" />
      <path d="M7.5 4c1-2 3.5-2 3.5-.3 0 1-1.5 1-3.5.3Z" />
    </svg>
  );
}
