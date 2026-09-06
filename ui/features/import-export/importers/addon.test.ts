// The addon export carries glyphs two ways — the legacy string form and the Cata table form — and
// the two take different routes to an item id. That branch is the piece of this importer that is
// pure enough to pin here; the rest of `onImport` is proto plumbing over a live `Database`.
import type { Database } from '@domain/proto_utils/database';
import type { GlyphConfig } from '@domain/talents/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `getWSEVersion()` runs at module evaluation, exactly as the vanilla `static` initialiser did, so
// importing this module fires a request. Stubbed in `vi.hoisted`, which runs before the imports.
const fetchStub = vi.hoisted(() => {
	const stub = vi.fn((_url: string) => Promise.reject(new Error('offline')));
	(globalThis as unknown as { fetch: unknown }).fetch = stub;
	return stub;
});

import { glyphToID } from './addon';

const glyphsConfig: Record<number, GlyphConfig> = {
	42897: { name: 'Glyph of Bull Rush' } as GlyphConfig,
	43395: { name: 'Glyph of Hamstring' } as GlyphConfig,
};

const db = { glyphSpellToItemId: vi.fn((spellId: number) => spellId + 1000) } as unknown as Database;

describe('glyphToID', () => {
	beforeEach(() => {
		db.glyphSpellToItemId = vi.fn((spellId: number) => spellId + 1000);
	});

	it('resolves the legacy string form by name, against the class config', () => {
		expect(glyphToID('Glyph of Hamstring', db, glyphsConfig)).toBe(43395);
		expect(db.glyphSpellToItemId).not.toHaveBeenCalled();
	});

	it('resolves the table form through the database, by spell id', () => {
		expect(glyphToID({ name: 'Glyph of Hamstring', spellID: 55 }, db, glyphsConfig)).toBe(1055);
		expect(db.glyphSpellToItemId).toHaveBeenCalledWith(55);
	});

	// An empty slot in the legacy form, which must not be mistaken for an unknown glyph.
	it('reads an empty string as no glyph', () => {
		expect(glyphToID('', db, glyphsConfig)).toBe(0);
	});

	it('throws on a name the class config does not have', () => {
		expect(() => glyphToID('Glyph of Nothing', db, glyphsConfig)).toThrow("Unknown glyph name 'Glyph of Nothing'");
	});

	// The failure is swallowed by design: no GitHub, no version warning, and the import still runs.
	it('asks GitHub for the addon version once, at module load', () => {
		expect(fetchStub).toHaveBeenCalledTimes(1);
		expect(fetchStub.mock.calls[0][0]).toBe('https://api.github.com/repos/wowsims/exporter/releases/latest');
	});
});
