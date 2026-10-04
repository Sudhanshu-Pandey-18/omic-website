// Single source of truth for OMIC's programme, taken from omic.spot (Oct 2026).
// Dates use UAE time (UTC+4).

/** the site can live at the root or in a sub-folder (GitHub Pages); url() adds that folder */
export const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
export const url = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? BASE.replace(/\/$/, '') + p : p);

export const VENUE = {
  name: 'OMIC Cultural Hub',
  line1: 'Warehouse 110',
  line2: 'Goshi Warehouse City',
  line3: 'Al Quoz, Dubai',
  maps: 'https://maps.app.goo.gl/UWvTuSzfT7zGVK7BA?g_st=ic',
};

export const EVENTS = [
  {
    id: 'art-prize',
    title: 'OMIC Art Prize 2026',
    kicker: 'Open call',
    pillar: 'culture',
    tags: ['Open call', 'Painting', 'Sculpture', 'Installation'],
    blurb: 'Open call for UAE-based artists on this year’s theme, “Shared Ground.”',
    start: '2026-09-24T00:00:00+04:00',
    end: '2026-10-20T23:59:00+04:00',
    when: 'Submissions close 20 Oct 2026',
    href: url('/events/art-prize.html'),
    poster: url('/assets/posters/art-prize.jpg'),
    ratio: '2000/1325',
  },
  {
    id: 'newton',
    title: 'Newton',
    kicker: 'Screening + Q&A',
    pillar: 'cinema',
    tags: ['Screening', 'Black comedy', 'Q&A'],
    blurb: 'The award-winning Hindi political satire, followed by a Q&A with director Amit V. Masurkar, actor Pankaj Tripathi and producer Manish Mundra.',
    start: '2026-10-10T18:00:00+04:00',
    end: '2026-10-10T21:00:00+04:00',
    when: 'Sat 10 Oct · 6:00 PM',
    href: url('/events/newton.html'),
    poster: url('/assets/posters/newton.jpg'),
    ratio: '1000/1250',
    full: true,
  },
  {
    id: 'nothing-unusual',
    title: 'Nothing Unusual',
    kicker: 'Inaugural exhibition',
    pillar: 'culture',
    tags: ['Exhibition', 'Painting', 'Video'],
    blurb: 'OMIC opens with its inaugural exhibition, curated by Narges Soleimanzadeh. Twelve artists make the ordinary newly visible.',
    start: '2026-09-18T00:00:00+04:00',
    end: '2026-10-19T23:59:00+04:00',
    when: '18 Sep – 19 Oct',
    href: url('/events/nothing-unusual.html'),
    poster: url('/assets/posters/nothing-unusual.jpg'),
    ratio: '1080/1350',
  },
  {
    id: 'afterimage',
    title: 'Panel Discussion + Afterimage',
    kicker: 'Talk + video art',
    pillar: 'talks',
    tags: ['Talk', 'Video art', 'Screening'],
    blurb: 'A screening and panel discussion exploring video art in the UAE, moderated by Valentina della Rocca.',
    start: '2026-09-26T17:00:00+04:00',
    end: '2026-09-26T19:00:00+04:00',
    when: 'Sat 26 Sep · 5:00–7:00 PM',
    href: url('/events/afterimage.html'),
    poster: url('/assets/posters/afterimage.jpg'),
    ratio: '2160/2700',
  },
];

/** live | upcoming | open | completed — computed against "now". */
export function statusOf(ev, now = new Date()) {
  const s = new Date(ev.start), e = new Date(ev.end);
  if (now > e) return 'completed';
  if (ev.id === 'art-prize') return now >= s ? 'open' : 'upcoming';
  if (now >= s) return 'live';
  return 'upcoming';
}

export const STATUS_LABEL = {
  live: 'On now',
  upcoming: 'Upcoming',
  open: 'Open call',
  completed: 'Completed',
};

export const MENU = [
  { name: 'Cappuccino', group: 'Coffee', img: url('/assets/menu/menu-01.jpg') },
  { name: 'Strawberry Matcha', group: 'Cold drinks', img: url('/assets/menu/menu-02.jpg') },
  { name: 'Tiramisu', group: 'Desserts', img: url('/assets/menu/menu-03.jpg') },
  { name: 'Pain au Chocolat', group: 'Pastries', img: url('/assets/menu/menu-04.jpg') },
  { name: 'San Sebastian Cheesecake', group: 'Desserts', img: url('/assets/menu/menu-05.jpg') },
  { name: 'Americano (Hot / Iced)', group: 'Coffee', img: url('/assets/menu/menu-06.jpg') },
  { name: 'Croissant & Coffee', group: 'Combos', img: url('/assets/menu/menu-07.jpg') },
  { name: 'Sandwich & Coffee', group: 'Combos', img: url('/assets/menu/menu-08.jpg'), note: '9 AM – 12 PM' },
  { name: 'Popcorn & Coke', group: 'Cinema snacks', img: url('/assets/menu/menu-09.jpg'), note: 'From 12 PM' },
  { name: 'Coke & Sandwich', group: 'Combos', img: url('/assets/menu/menu-10.jpg'), note: 'From 12 PM' },
];
