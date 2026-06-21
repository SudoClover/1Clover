import { describe, it, expect } from 'vitest';
import { healthStatus } from './health';

describe('healthStatus', () => {
	it('reports the service as ok', () => {
		expect(healthStatus()).toEqual({ status: 'ok', service: 'clover' });
	});
});
