// server/test/helpers.ts
import Fastify from 'fastify';
import { registerRoutes } from '../src/routes.js';
import { registerPairingRoutes } from '../src/pairingRoutes.js';
import { registerCatalogRoutes } from '../src/catalogRoutes.js';
import { registerVoteRoutes } from '../src/voteRoutes.js';
import { registerAdminRoutes } from '../src/adminRoutes.js';

/** Fastify instance wired the same way index.ts wires it, minus HTTPS/static — for app.inject() tests. */
export function buildTestApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app);
  registerPairingRoutes(app);
  registerCatalogRoutes(app);
  registerVoteRoutes(app);
  registerAdminRoutes(app);
  return app;
}
