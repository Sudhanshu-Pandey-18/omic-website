import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (p) => resolve(__dirname, p);

export default defineConfig({
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
