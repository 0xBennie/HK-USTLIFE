// Original 24×24 outline glyphs; not exported Apple SF Symbols assets.
export const iconPaths = {
  today: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 2v4m10-4v4M3 9h18M7 13h3m4 0h3m-10 4h3',
  campus: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5m6-2v16m6-14v16',
  discover: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20m4-16-2 8-8 4 4-8 6-4',
  inbox: 'M4 4h16v16H4V4m0 10h5l1 3h4l1-3h5',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-8 9v-2a8 5 0 0 1 16 0v2',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  search: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 6 6',
  bus: 'M6 3h12a2 2 0 0 1 2 2v13H4V5a2 2 0 0 1 2-2M4 11h16M7 18v3m10-3v3M7 14h1m8 0h1M8 6h8',
  book: 'M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2V3',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2 21v-3a7 5 0 0 1 14 0v3m0-17a3.5 3.5 0 0 1 0 7m3 3a5 4 0 0 1 3 4v3',
  check: 'M5 12l4 4L19 6',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v12H5V10m7 4v4',
  moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
};
export type IconName = keyof typeof iconPaths;
