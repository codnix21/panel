import express from 'express';
import cors from 'cors';
import { config } from './config';
import { pool } from './db';
import { runMigrations, createAdminUser } from './db/migrations';
import { ipAllowlistMiddleware } from './middleware/ipAllowlist';
import { assertStrongSecrets } from './validateSecrets';
import authRoutes from './routes/auth';
import nodeRoutes from './routes/nodes';
import proxyRoutes from './routes/proxies';
import allProxiesRoutes from './routes/allProxies';
import auditRoutes from './routes/audit';

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(ipAllowlistMiddleware);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/nodes', proxyRoutes);
app.use('/api/proxies', allProxiesRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', database: 'ok' });
  } catch (e: any) {
    res.status(503).json({ status: 'not_ready', database: 'error', error: e?.message || 'db' });
  }
});

async function bootstrap(): Promise<void> {
  try {
    assertStrongSecrets();
    await runMigrations();

    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (adminUser && adminPass) {
      await createAdminUser(adminUser, adminPass);
    }

    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Panel backend running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start panel backend:', error);
    process.exit(1);
  }
}

bootstrap();
