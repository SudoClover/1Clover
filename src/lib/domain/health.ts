/**
 * Liveness payload for the /healthz endpoint.
 *
 * Pure and framework-free (no I/O, no SvelteKit imports) so it lives in the
 * domain layer and is unit-testable without a server — see ARCHITECTURE.md §2.
 */
export interface HealthStatus {
	status: 'ok';
	service: 'clover';
}

export function healthStatus(): HealthStatus {
	return { status: 'ok', service: 'clover' };
}
