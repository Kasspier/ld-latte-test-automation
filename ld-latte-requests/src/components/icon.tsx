import type { CSSProperties } from "react";

const paths = {
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  logout: "M9 3H4v18h5m5-14 5 5-5 5M9 12h12",
  close: "m6 6 12 12M6 18 18 6",
  edit: "m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z",
  bot: "M7 7h10a4 4 0 0 1 4 4v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a4 4 0 0 1 4-4ZM12 7V3M9 13h.01M15 13h.01M8 17h8",
  link: "m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  chart: "M4 3v18h17M8 16v-4m5 4V8m5 8V5",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  check: "m5 12 4 4L19 6",
  chevron: "m9 5 7 7-7 7",
} as const;

export function Icon({
  name,
  size = 20,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
