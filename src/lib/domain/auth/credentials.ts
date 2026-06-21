/**
 * Pure credential validation shared by the signup / login / reset server actions.
 * No I/O, no framework imports — unit-tested in isolation (ARCHITECTURE.md §2).
 * The username rule mirrors the DB CHECK on profiles.username.
 */

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
export const MIN_PASSWORD_LENGTH = 8;

export interface FieldError {
	field: 'email' | 'password' | 'username';
	message: string;
}

export function validateUsername(username: string): FieldError | null {
	if (!USERNAME_RE.test(username)) {
		return {
			field: 'username',
			message: 'Username must be 3–30 characters: lowercase letters, numbers, or underscores.'
		};
	}
	return null;
}

export function validateEmail(email: string): FieldError | null {
	// Deliberately permissive; the real proof of ownership is the confirmation email.
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		return { field: 'email', message: 'Enter a valid email address.' };
	}
	return null;
}

export function validatePassword(password: string): FieldError | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return {
			field: 'password',
			message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
		};
	}
	return null;
}

export function validateSignup(input: {
	email: string;
	password: string;
	username: string;
}): FieldError[] {
	return [
		validateUsername(input.username),
		validateEmail(input.email),
		validatePassword(input.password)
	].filter((e): e is FieldError => e !== null);
}
