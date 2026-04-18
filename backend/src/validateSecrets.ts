import { config } from './config';

const DEFAULT_JWT = 'change-me-in-production';

export function assertStrongSecrets(): void {
  if (!config.requireStrongSecrets) {
    return;
  }

  const jwt = config.jwtSecret;
  if (!jwt || jwt === DEFAULT_JWT) {
    throw new Error(
      'Set JWT_SECRET to a random string (not the default). In production REQUIRE_STRONG_SECRETS is implied by NODE_ENV=production.'
    );
  }
  if (jwt.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters when strong secrets are required.');
  }
}
