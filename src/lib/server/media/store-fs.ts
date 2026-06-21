/**
 * Node filesystem object store for LOCAL DEV + tests (ADR-0012). Stands in for R2
 * when there is no real bucket. Object keys are server-generated, but we still
 * reject any key escaping the base directory as defence in depth. NEVER used in
 * prod — the prod consumer Worker uses the R2 binding.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import type { MediaStore } from './pipeline';

export function createFsStore(baseDir: string): MediaStore {
	const root = normalize(baseDir);

	function pathFor(key: string): string {
		const full = normalize(join(root, key));
		if (full !== root && !full.startsWith(root + sep)) {
			throw new Error(`Refusing object key outside the store: ${key}`);
		}
		return full;
	}

	return {
		async get(key: string): Promise<Uint8Array | null> {
			try {
				return new Uint8Array(await readFile(pathFor(key)));
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
				throw err;
			}
		},
		async put(key: string, bytes: Uint8Array): Promise<void> {
			const path = pathFor(key);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, bytes);
		}
	};
}
