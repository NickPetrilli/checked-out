import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Copies stockfish lite-single WASM pair to public/ so it can be loaded as a Worker.
const copyStockfishPlugin = {
  name: 'copy-stockfish',
  buildStart() {
    const bin = resolve(__dirname, 'node_modules/stockfish/bin');
    const pub = resolve(__dirname, 'public');
    for (const f of ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm']) {
      const src = `${bin}/${f}`;
      const dest = `${pub}/${f}`;
      if (existsSync(src)) copyFileSync(src, dest);
    }
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), copyStockfishPlugin],
});
