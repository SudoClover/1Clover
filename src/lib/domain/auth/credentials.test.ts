import { describe, it, expect } from 'vitest';
import { validateUsername, validateEmail, validatePassword, validateSignup } from './credentials';

describe('validateUsername', () => {
	it('accepts a valid username', () => {
		expect(validateUsername('clover_99')).toBeNull();
	});
	it.each(['ab', 'UPPER', 'has space', 'bad-dash', 'a'.repeat(31)])('rejects %j', (name) => {
		expect(validateUsername(name)?.field).toBe('username');
	});
});

describe('validateEmail', () => {
	it('accepts a normal address', () => {
		expect(validateEmail('a@b.co')).toBeNull();
	});
	it.each(['nope', 'a@b', 'a b@c.d'])('rejects %j', (email) => {
		expect(validateEmail(email)?.field).toBe('email');
	});
});

describe('validatePassword', () => {
	it('accepts 8+ characters', () => {
		expect(validatePassword('hunter2!')).toBeNull();
	});
	it('rejects short passwords', () => {
		expect(validatePassword('short')?.field).toBe('password');
	});
});

describe('validateSignup', () => {
	it('returns no errors for valid input', () => {
		expect(validateSignup({ email: 'a@b.co', password: 'hunter2!', username: 'clover' })).toEqual(
			[]
		);
	});
	it('collects every invalid field', () => {
		const errors = validateSignup({ email: 'x', password: 'y', username: 'Z' });
		expect(errors.map((e) => e.field).sort()).toEqual(['email', 'password', 'username']);
	});
});
