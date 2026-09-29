import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const coreDirectory = path.dirname(require.resolve('@litert-lm/core/package.json'));
const pdfDirectory = path.dirname(require.resolve('pdfjs-dist/package.json'));
const papersDirectory = path.join(root, 'test/fixtures/papers');
const headers = {'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp'};
const assets: Record<string, string> = {
  examples: papersDirectory,
  workers: path.join(pdfDirectory, 'build'),
  wasm: path.join(coreDirectory, 'wasm'),
  models: path.join(root, 'models'),
};

export default defineConfig({
  base: './',
  build: {emptyOutDir: true, sourcemap: false},
  optimizeDeps: {include: ['officeparser']},
  server: {port: 5173, headers, fs: {allow: ['.']}},
  preview: {headers},
  plugins: [{
    name: 'local-document-and-runtime-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = request.url?.split('?')[0].match(/^\/(examples|workers|wasm|models)\/([a-zA-Z0-9._-]+)$/);
        if (!match || !['GET', 'HEAD'].includes(request.method || '')) return next();
        const [, directory, filename] = match;
        if (directory === 'examples' && !['bitcoin.pdf', 'attention.pdf', 'gfs.pdf', 'mapreduce.pdf', 'raft.pdf'].includes(filename)) return next();
        if (directory === 'workers' && filename !== 'pdf.worker.min.mjs') return next();
        const file = path.join(assets[directory], filename);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        response.writeHead(200, {
          'Content-Type': filename.endsWith('.pdf') ? 'application/pdf' : /\.(mjs|js)$/.test(filename) ? 'application/javascript' :
            filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
          'Content-Length': fs.statSync(file).size,
          'Cross-Origin-Resource-Policy': 'same-origin',
        });
        if (request.method === 'HEAD') response.end();
        else fs.createReadStream(file).pipe(response);
      });
      server.middlewares.use((request, response, next) => {
        const match = request.url?.split('?')[0].match(/^\/pdf-assets\/(cmaps|standard_fonts|wasm)\/([a-zA-Z0-9._-]+)$/);
        if (!match || !['GET', 'HEAD'].includes(request.method || '')) return next();
        const file = path.join(pdfDirectory, match[1], match[2]);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        response.writeHead(200, {'Content-Type': file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
          'Content-Length': fs.statSync(file).size, 'Cross-Origin-Resource-Policy': 'same-origin'});
        if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
      });
    },
    closeBundle() {
      const output = path.join(root, 'dist');
      fs.mkdirSync(path.join(output, 'examples'), {recursive: true});
      for (const name of ['bitcoin', 'attention', 'gfs', 'mapreduce', 'raft'])
        fs.copyFileSync(path.join(papersDirectory, `${name}.pdf`), path.join(output, 'examples', `${name}.pdf`));
      fs.copyFileSync(path.join(papersDirectory, 'UPSTREAM-LICENSE.txt'), path.join(output, 'examples/UPSTREAM-LICENSE.txt'));
      fs.mkdirSync(path.join(output, 'workers'), {recursive: true});
      fs.copyFileSync(path.join(pdfDirectory, 'build/pdf.worker.min.mjs'), path.join(output, 'workers/pdf.worker.min.mjs'));
      for (const directory of ['cmaps', 'standard_fonts', 'wasm'])
        fs.cpSync(path.join(pdfDirectory, directory), path.join(output, 'pdf-assets', directory), {recursive: true});
      fs.cpSync(assets.wasm, path.join(output, 'wasm'), {recursive: true});
      // Keep local development weights out of the Git/deployment bundle.
      if (fs.existsSync(assets.models)) {
        fs.mkdirSync(path.join(output, 'models'), {recursive: true});
        for (const filename of fs.readdirSync(assets.models).filter(name => name.endsWith('.litertlm')))
          fs.symlinkSync(path.join(assets.models, filename), path.join(output, 'models', filename), 'file');
      }
    },
  }],
});
