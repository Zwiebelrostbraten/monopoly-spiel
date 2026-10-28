// Original hand-drawn geometry. Legacy values are resolved only for display.
export const avatars = [
  {
    id: "dog",
    name: "Hund",
    path: "M9 42V29l7-5 2-12 8 5 6-2 7 7-6 7-7-1 1 14h-6l-2-11-5 2v9Zm20-11h15l6-11 5 2-5 17-6 2v8h-6v-8h-9Z",
  },
  {
    id: "car",
    name: "Auto",
    path: "M6 34l8-4 9-13h19l9 14 7 4v11H6Zm16-4h22l-6-8H27Z",
    extra: '<circle cx="18" cy="46" r="7"/><circle cx="47" cy="46" r="7"/>',
  },
  {
    id: "hat",
    name: "Zylinder",
    path: "M18 13q14-6 28 0l-3 28q14 2 14 7c0 9-50 9-50 0q0-5 14-7Zm3 21-1 7q12 5 23 0l1-7q-12 4-23 0Z",
  },
  {
    id: "ship",
    name: "Schiff",
    path: "M5 40h54L49 53H18Zm12-4V25h12V12h8v13h13v11Zm25-13V12h7v11Z",
    extra: '<path d="M9 57q6-4 12 0t12 0t12 0t12 0" fill="none"/>',
  },
  {
    id: "shoe",
    name: "Schuh",
    path: "M11 15h16l3 16 8 5 15 2q7 2 6 11L6 51l1-13 5-7Zm-5 36h53v5H6Z",
    extra: '<path d="m28 31 7-2m-3 7 7-3m-1 7 7-3" fill="none"/>',
  },
  {
    id: "thimble",
    name: "Fingerhut",
    path: "M17 47 21 16q11-12 22 0l5 31q8 7 0 10H17q-8-3 0-10Z",
    extra:
      '<path d="M22 22h3m7 0h3m7 0h1M21 30h3m7 0h3m7 0h3M20 38h3m7 0h3m7 0h4M18 47q14 5 29 0" fill="none"/>',
  },
  {
    id: "cat",
    name: "Katze",
    path: "M21 28 19 10l12 8 12-8-1 19-5 7q11 9 8 18H19q-5-12 5-19Zm20 20q15-4 11-18l5-2q9 24-14 28Z",
    extra:
      '<path d="M25 26h2m8 0h2m-9 6 4 2 4-2M29 41v12m7-12v12" fill="none"/>',
  },
  {
    id: "wheelbarrow",
    name: "Schubkarre",
    path: "m10 19 39 3-8 18H21Zm-6-7 8 2 10 30h22v5H19L8 19H4Zm36 28 12 13-4 3-14-15Z",
    extra:
      '<circle cx="20" cy="50" r="8"/><circle cx="20" cy="50" r="3" fill="#eef3ef"/>',
  },
];
const legacy = ["◆", "●", "▲", "★", "♟", "✿", "☀", "⬟"];
export function resolveAvatar(value) {
  return (
    avatars.find((a) => a.id === value) ||
    avatars[legacy.indexOf(value)] ||
    avatars[0]
  );
}
let serial = 0;
export function figureSVG(value) {
  const a = resolveAvatar(value),
    id = `metal-${a.id}-${serial++}`;
  return `<svg class="figure-svg" data-avatar="${a.id}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0.85" y2="1"><stop stop-color="#ffffff"/><stop offset=".28" stop-color="#dce4e4"/><stop offset=".46" stop-color="#879b9e"/><stop offset=".56" stop-color="#eef2ef"/><stop offset="1" stop-color="#52676c"/></linearGradient></defs><ellipse cx="32" cy="57" rx="25" ry="4" fill="#122d36" opacity=".22"/><g fill="url(#${id})" stroke="#42565d" stroke-width="1.6" stroke-linejoin="round"><path d="${a.path}"/>${a.extra || ""}</g><path d="M15 59h34" stroke="#fff" opacity=".65" stroke-linecap="round"/></svg>`;
}
const fields = {
  go: "M7 34h43M35 17l17 17-17 17",
  jail: "M12 54V12h40v42M22 12v42m10-42v42m10-42v42M12 24h40M12 43h40",
  gojail: "M8 15h26v34m-12-12 12 12 12-12M46 10v16m8-16v16",
  rail: "M18 43h28V18q-14-8-28 0Zm0-13h28M25 18v12m14-12v12M22 43l-8 13m28-13 8 13M18 51h28M24 37h1m14 0h1",
  utility: "m34 6-20 29h17l-3 23 22-32H34Z",
  community: "M8 18h48v34H8Zm0 0 24 21 24-21M8 52l17-17m31 17L39 35",
  chance: "m12 12 36-4 5 43-36 5Zm14 12q0-9 9-8t5 12l-7 7v5m0 6v2",
  tax: "m10 19 22-11 22 11Zm4 5h36M18 26v21m14-21v21m14-21v21M10 53h44M14 47h36",
  parking:
    "M8 52h48M18 48V13h17q18 0 18 14T35 41H18m10-20v12h7q10 0 10-6t-10-6Z",
  house: "M7 30 32 9l25 21M14 26v29h36V26M27 55V37h10v18",
  hotel:
    "M14 56V10h36v46M8 56h48M23 19h4m10 0h4m-18 9h4m10 0h4m-18 9h4m10 0h4M28 56V45h8v11",
};
export function fieldSVG(type) {
  return `<svg class="field-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="${fields[type] || fields.house}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
