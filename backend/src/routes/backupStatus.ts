import { Router, Response } from 'express';
import fs from 'fs/promises';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response) => {
  if (!config.backupStatusFile) {
    res.json({ configured: false, lastBackupAt: null as string | null });
    return;
  }
  try {
    const raw = await fs.readFile(config.backupStatusFile, 'utf8');
    const j = JSON.parse(raw) as { lastBackupAt?: string };
    res.json({ configured: true, lastBackupAt: j.lastBackupAt ?? null });
  } catch {
    res.json({ configured: true, lastBackupAt: null as string | null, unreadable: true });
  }
});

export default router;
