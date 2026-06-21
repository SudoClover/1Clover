import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/types/database';

// Runs against LOCAL Supabase (CLAUDE.md §6 — never mock the DB). Env comes from
// .env locally (loaded by dotenv) or the CI workflow.
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const PUBLISHABLE = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

// Admin (service role) client bypasses RLS — used only to set up/verify/tear down.
const admin = createClient<Database>(URL, SECRET, {
	auth: { autoRefreshToken: false, persistSession: false }
});

/** Create a confirmed user and return an RLS-scoped client signed in as them. */
async function makeUser(username: string) {
	const email = `${username}@example.test`;
	const password = 'password123';
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { username }
	});
	if (error) throw error;

	const client = createClient<Database>(URL, PUBLISHABLE, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	const { error: signInError } = await client.auth.signInWithPassword({ email, password });
	if (signInError) throw signInError;
	return { userId: data.user.id, client };
}

describe('profiles: signup trigger + RLS isolation (integration)', () => {
	let alice: Awaited<ReturnType<typeof makeUser>>;
	let bob: Awaited<ReturnType<typeof makeUser>>;

	beforeAll(async () => {
		const suffix = Date.now().toString(36);
		alice = await makeUser(`alice_${suffix}`);
		bob = await makeUser(`bob_${suffix}`);
	});

	afterAll(async () => {
		await admin.auth.admin.deleteUser(alice.userId);
		await admin.auth.admin.deleteUser(bob.userId);
	});

	it('auto-creates a profile on signup (trigger)', async () => {
		const { data, error } = await alice.client
			.from('profiles')
			.select('id, username')
			.eq('id', alice.userId)
			.single();
		expect(error).toBeNull();
		expect(data?.id).toBe(alice.userId);
		expect(data?.username).toMatch(/^alice_/);
	});

	it('lets a user update their own profile', async () => {
		const { error } = await alice.client
			.from('profiles')
			.update({ display_name: 'Alice' })
			.eq('id', alice.userId);
		expect(error).toBeNull();
	});

	it("does NOT let a user change someone else's profile", async () => {
		await bob.client.from('profiles').update({ display_name: 'Bob' }).eq('id', bob.userId);
		// RLS hides Bob's row from Alice's UPDATE — 0 rows change, no error.
		await alice.client.from('profiles').update({ display_name: 'hacked' }).eq('id', bob.userId);
		const { data } = await admin
			.from('profiles')
			.select('display_name')
			.eq('id', bob.userId)
			.single();
		expect(data?.display_name).toBe('Bob');
	});

	it('does not expose birthdate to client roles', async () => {
		const { error } = await alice.client
			.from('profiles')
			.select('birthdate')
			.eq('id', alice.userId);
		expect(error).not.toBeNull();
	});

	it('allows anonymous read of public profile columns', async () => {
		const anon = createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });
		const { data, error } = await anon
			.from('profiles')
			.select('username')
			.eq('id', alice.userId)
			.single();
		expect(error).toBeNull();
		expect(data?.username).toMatch(/^alice_/);
	});
});
