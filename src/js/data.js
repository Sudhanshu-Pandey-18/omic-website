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
  phone: '+971 4 398 3354',
  phoneHref: 'tel:+97143983354',
  whatsapp: '+971 56 185 7647',
  whatsappHref: 'https://wa.me/971561857647',
  email: 'gallery@omic.spot',
};

export const EVENTS = [
  {
    id: 'linocut-workshop',
    title: 'Linocut Workshop',
    kicker: 'Printmaking workshop',
    pillar: 'workshop',
    tags: ['Workshop', 'Printmaking', 'Beginner friendly'],
    blurb: 'Learn linocut printing in two hours with artist Elizaveta Pugacheva: carve your own block and pull several prints.',
    start: '2026-10-23T14:00:00+04:00',
    end: '2026-10-23T16:00:00+04:00',
    when: 'Fri 23 Oct · 2:00 PM',
    href: url('/events/linocut-workshop.html'),
    poster: url('/assets/posters/linocut-workshop.jpg'),
    ratio: '3013/1966',
    price: 'AED 400',
    seats: 15,
    host: 'Elizaveta Pugacheva',
  },
  {
    id: 'unspoken-workshop',
    title: 'UNSPOKEN: Reimagining the Portrait',
    kicker: 'Acrylic portrait workshop',
    pillar: 'workshop',
    tags: ['Workshop', 'Acrylic', 'Portraiture'],
    blurb: 'A contemporary acrylic workshop with Sami Alkour, treating the portrait as mood and presence. Take home your own canvas.',
    start: '2026-10-24T11:00:00+04:00',
    end: '2026-10-24T13:00:00+04:00',
    when: 'Sat 24 Oct · 11:00 AM',
    href: url('/events/unspoken-workshop.html'),
    poster: url('/assets/posters/unspoken-workshop.jpg'),
    ratio: '2400/1566',
    price: 'AED 285',
    seats: 15,
    host: 'Sami Alkour',
  },
  {
    id: 'art-prize',
    title: 'OMIC Art Prize 2026',
    kicker: 'Open call · closed',
    pillar: 'culture',
    tags: ['Open call', 'Painting', 'Sculpture', 'Installation'],
    blurb: 'Submissions for this year’s theme, “Shared Ground,” are closed. The jury is now reviewing the entries.',
    start: '2026-09-24T00:00:00+04:00',
    end: '2026-10-20T23:59:00+04:00',
    when: 'Submissions closed 20 Oct',
    href: url('/events/art-prize.html'),
    poster: url('/assets/posters/art-prize.jpg'),
    ratio: '2000/1325',
  },
  {
    id: 'living-room',
    title: 'Living Room',
    kicker: 'Group exhibition',
    pillar: 'culture',
    tags: ['Exhibition', 'Group show', '8 artists'],
    blurb: 'A group exhibition curated by Narges Soleimanzadeh that turns the artist’s gaze to what is closest: the everyday.',
    start: '2026-10-09T17:00:00+04:00',
    end: '2026-10-19T23:59:00+04:00',
    when: '9 – 19 Oct',
    href: url('/events/living-room.html'),
    poster: url('/assets/posters/living-room.jpg'),
    ratio: '954/1192',
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
    when: 'Sat 10 Oct',
    href: url('/events/newton.html'),
    poster: url('/assets/posters/newton.jpg'),
    ratio: '1000/1250',
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
    when: 'Sat 26 Sep',
    href: url('/events/afterimage.html'),
    poster: url('/assets/posters/afterimage.jpg'),
    ratio: '2160/2700',
  },
];

/** live | upcoming | open | completed — computed against "now". Dates are UAE time. */
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

/** what's happening now or next, soonest first (used by the header, hero and footer) */
export function currentEvents(now = new Date()) {
  return EVENTS.filter((e) => statusOf(e, now) !== 'completed').sort((a, b) => new Date(a.start) - new Date(b.start));
}

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
