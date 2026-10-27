import React from 'react';
const paths: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  network: <><rect x="8" y="3" width="8" height="5" rx="1"/><rect x="2" y="16" width="7" height="5" rx="1"/><rect x="15" y="16" width="7" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/></>,
  timeline: <><path d="M5 3v18M9 6h11M9 12h7M9 18h10"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
  report: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/></>,
  folder: <path d="M3 6h7l2 3h9v11H3z"/>,
  play: <path d="m8 5 11 7-11 7z"/>, pause: <><path d="M8 5v14M16 5v14"/></>,
  back: <><path d="M6 5v14M18 5l-9 7 9 7z"/></>, next: <><path d="M18 5v14M6 5l9 7-9 7z"/></>,
  expand: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  server: <><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01M11 6h6M11 17h6"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>, search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 7a8 8 0 0 1 14-1l1 6M4 12l1 6a8 8 0 0 0 14-1"/></>,
};
export default function Icon({name, size = 20}: {name: string; size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}
