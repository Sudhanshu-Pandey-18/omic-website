import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (p) => resolve(__dirname, p);

// BASE_PATH lets the same code run at the root (Cloudflare, omic.spot) or under a sub-folder
// (GitHub Pages: /omic-website/). The plugin below prefixes every root-absolute path in the HTML.
const base = process.env.BASE_PATH || '/';

function baseAwareHtml() {
  const b = base.replace(/\/$/, '');
  const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    name: 'omic-base-aware-html',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!b) return html;
        return html
          // attributes like href="/x", src="/x", data-poster="/x", content="/x" (not //cdn or already prefixed)
          .replace(new RegExp(`(\\s[\\w:-]+=")\\/(?!\\/)(?!${esc.slice(1)}\\/)`, 'g'), `$1${b}/`)
          // inline style url(/x)
          .replace(new RegExp(`url\\(\\/(?!\\/)(?!${esc.slice(1)}\\/)`, 'g'), `url(${b}/`);
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [baseAwareHtml()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        home: page('index.html'),
        programme: page('programme.html'),
        cafe: page('cafe.html'),
        visit: page('visit.html'),
        newton: page('events/newton.html'),
        artPrize: page('events/art-prize.html'),
        nothingUnusual: page('events/nothing-unusual.html'),
        afterimage: page('events/afterimage.html'),
        notFound: page('404.html'),
      },
    },
  },
});
