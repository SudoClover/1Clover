/**
 * Safety classifier — Slice 2 STUB. Real Workers AI classification lands in Slice 8;
 * its output is a routing signal (suspect → `held`), never an auto-verdict
 * (ARCHITECTURE §5/§9). The classifier treats image bytes as DATA only and never
 * interprets any content as instructions (security invariant #1).
 */
import type { Classifier } from './pipeline';

/** Auto-approves everything in dev/CI. Swap for the Workers AI classifier in Slice 8. */
export const stubClassifier: Classifier = async () => 'clean';
