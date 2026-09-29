import type { ElementType, SVGProps } from 'react';

export type CategoryIcon = ElementType;

export function FashionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M5.15 2.4 3.3 3.15 1.5 5.35l1.85 1.1.8-1.05v7.1h6.7V5.4l.8 1.05 1.85-1.1-1.8-2.2-1.85-.75c-.35.9-1.15 1.35-2.35 1.35S5.5 3.3 5.15 2.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FoodIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M7.7 4.25c.05-1.25.75-2.1 2-2.55M8 4.1c1.55-1.05 3.55-.25 4.05 1.55.65 2.35-1.55 6.8-3.25 6.8-.55 0-.8-.3-1.3-.3s-.75.3-1.3.3c-1.7 0-3.9-4.45-3.25-6.8C3.45 3.85 5.45 3.05 7 4.1c.35.25.65.25 1 0Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 15 15" aria-hidden="true" focusable="false" {...props}>
      <circle cx="3.2" cy="5.1" r="1.25" fill="currentColor" />
      <circle cx="6.15" cy="3.3" r="1.3" fill="currentColor" />
      <circle cx="9.2" cy="3.3" r="1.3" fill="currentColor" />
      <circle cx="12" cy="5.2" r="1.25" fill="currentColor" />
      <path
        d="M7.55 5.45c-2.25 0-4.15 2.35-3.8 4.25.25 1.4 1.75 1.85 3.8 1.2 2.05.65 3.55.2 3.8-1.2.35-1.9-1.55-4.25-3.8-4.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function VoucherIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M2 3.25h11v2.1a1.65 1.65 0 0 0 0 3.3v2.1H2v-2.1a1.65 1.65 0 0 0 0-3.3v-2.1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8.85 4.45v1.1m0 1.15v1.1m0 1.15v1.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="m5.25 5.15.45.9 1 .15-.72.7.17 1-.9-.47-.9.47.17-1-.72-.7 1-.15.45-.9Z"
        fill="currentColor"
      />
    </svg>
  );
}
