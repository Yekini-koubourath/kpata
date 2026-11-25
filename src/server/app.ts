import express from 'express';
import { getDb } from './db';
import { ensureSeedData } from './seed';
import { attachAuth } from './auth';
import { authRouter, userRouter } from './routes/authRoutes';
import { groupRouter, invitationRouter } from './routes/groupRoutes';
import { financeRouter } from './routes/financeRoutes';
import { adminRouter, publicAndPaymentRouter } from './routes/adminAndPaymentRoutes';
import {
  buildRobotsTxt,
  buildSitemapXml,
  getPublicOrigin,
  isPrivateNoindexPath,
} from './seo';

export function createApiApp(): express.Express {
  getDb();
  ensureSeedData();

  const app = express();
  app.set('trust proxy', true);

  // Security headers (avoid X-Frame-Options so AI Studio iframe works properly)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isPrivateNoindexPath(req.path)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  });

  // Capture rawBody for FedaPay HMAC signature verification
  app.use(
    express.json({
      limit: '8mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(attachAuth);

  // SEO Crawler endpoints
  app.get('/robots.txt', (req, res) => {
    const origin = getPublicOrigin(req);
    res.type('text/plain; charset=utf-8').send(buildRobotsTxt(origin));
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = getPublicOrigin(req);
    res.type('application/xml; charset=utf-8').send(buildSitemapXml(origin));
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kpata-api', timestamp: new Date().toISOString() });
  });

  // API Routers (public/webhook router must precede authenticated financeRouter)
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/groups', groupRouter);
  app.use('/api/invitations', invitationRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicAndPaymentRouter);
  app.use('/api', financeRouter);

  return app;
}
