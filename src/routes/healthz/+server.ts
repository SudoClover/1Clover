import { json } from '@sveltejs/kit';
import { healthStatus } from '$lib/domain/health';
import type { RequestHandler } from './$types';

// Liveness probe. Public, no auth, no DB — safe to hit from CI/uptime checks.
export const GET: RequestHandler = () => json(healthStatus());
