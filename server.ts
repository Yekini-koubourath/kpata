import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './src/server/app';
import { injectSeoIntoHtml } from './src/server/seo';

async function startServer() {
  const app = createApiApp();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        const { html, is404 } = injectSeoIntoHtml(template, req);
        res.status(is404 ? 404 : 200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));

    app.use('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        res.status(500).send('Build dist/index.html manquant.');
        return;
      }
      const template = fs.readFileSync(indexPath, 'utf-8');
      const { html, is404 } = injectSeoIntoHtml(template, req);
      res.status(is404 ? 404 : 200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`KPATA server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KPATA server:', err);
  process.exit(1);
});
