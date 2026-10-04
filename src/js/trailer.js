// Trailer lightbox: clicking any [data-trailer] / [data-trailer-btn] opens a YouTube (no-cookie) player.
export function trailerModal() {
  const triggers = document.querySelectorAll('[data-trailer], [data-trailer-btn]');
  if (!triggers.length) return;
  let modal = document.querySelector('.trailer');
  const fresh = !modal;
  if (fresh) modal = document.createElement('div');
  if (fresh) {
    modal.className = 'trailer';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Trailer');
    modal.innerHTML = '<button class="trailer-close" aria-label="Close trailer">Close ✕</button><div class="trailer-frame"></div>';
    document.body.appendChild(modal);
  }
  const frame = modal.querySelector('.trailer-frame');
  let lastFocus;
  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => { frame.innerHTML = ''; }, 500);
    lastFocus && lastFocus.focus();
  };
  const open = (id) => {
    lastFocus = document.activeElement;
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="Newton trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    modal.classList.add('is-open');
    modal.querySelector('.trailer-close').focus();
  };
  triggers.forEach((t) => {
    t.addEventListener('click', (e) => { e.preventDefault(); open(t.dataset.trailer || t.dataset.trailerBtn); });
    if (t.dataset.trailer) { t.setAttribute('role', 'button'); t.tabIndex = 0; t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t.dataset.trailer); } }); }
  });
  if (!fresh) return;
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.trailer-close')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
}
