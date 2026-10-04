// Single entry for every page: boot once, mount the current page, then let the router swap pages.
import { bootOnce, initPage } from './core.js';
import { startRouter } from './router.js';
import { mountHome } from './home.js';
import { mountPage } from './page.js';

const mount = async () => {
  const main = document.querySelector('main');
  initPage(main, document.body.dataset.page === 'home' ? mountHome : mountPage);
};

(async () => {
  await bootOnce();
  await mount();
  startRouter(mount);
})();
