// Inline line icons (24x24, stroke = currentColor). Drawn for this site.

const P: Record<string, string> = {
  tree: '<path d="M5 4h6M5 4v16M5 10h5M5 16h5"/><rect x="11" y="7.5" width="8" height="5" rx="1.5"/><rect x="11" y="13.5" width="8" height="5" rx="1.5"/><rect x="11" y="1.5" width="8" height="5" rx="1.5"/>',
  cursor: '<path d="M5 3l13 6.5-5.6 1.6L10.8 17z"/><path d="M13.2 12.2L19 18"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  bell: '<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8.5l1.3 1.3L12 7.2M8 14.5l1.3 1.3 2.7-2.6M14 9h2.5M14 15h2.5"/>',
  camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4"/>',
  shield: '<path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/><path d="M8.5 12l2.4 2.4L15.5 10"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2.5 8-7 8-3 0-4.5-2-6-4.5L2.8 14a1.5 1.5 0 012.6-1.5L8 15"/>',
  mask: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 20L20 4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8L16.5 9"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  scroll: '<path d="M7 3h10a3 3 0 013 3v1h-4M7 3a3 3 0 00-3 3v12a3 3 0 003 3h9a3 3 0 003-3V7"/><path d="M8 10h7M8 14h7M8 18h4"/>',
  github:
    '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0012 2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  play: '<path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13" stroke-width="2.6"/>',
  restart: '<path d="M4 12a8 8 0 108-8c-2.4 0-4.5 1-6 2.7"/><path d="M5 3v4.2h4.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M9 12.5v1.5M15 12.5v1.5"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
}

export function icon(name: string, cls = 'ic'): string {
  const body = P[name] || ''
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
}

/** The logo: a phone with an agent's glowing edge and a cursor. */
export function logo(id: string, cls = 'logo-mark'): string {
  return `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c9bff"/><stop offset=".55" stop-color="#3d63ff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
  <rect x="6.5" y="2.5" width="19" height="27" rx="5.5" fill="none" stroke="url(#${id})" stroke-width="2.4"/>
  <path d="M13.2 11.2l8.6 4.3-3.7 1.05-1.7 3.75z" fill="currentColor"/>
</svg>`
}
