import { NATIVE_COMBINATIONS_LIMIT, NATIVE_ITERATIONS_LIMIT, WEB_COMBINATIONS_LIMIT, WEB_ITERATIONS_LIMIT } from '@sim/bulk/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `isExternal` reads `window.location.hostname` once, at module load, so it cannot be steered by
// setting the location afterwards.
const isExternal = vi.hoisted(() => vi.fn(() => false));
vi.mock('@ui-kit/utils/dom', () => ({ isExternal }));

const { bulkCombinationsLimit, bulkIterationsLimit, bulkLimitForHost } = await import('./limits');

describe('bulkLimitForHost', () => {
	beforeEach(() => isExternal.mockReturnValue(false));

	it('trusts the resolved probe over the hostname, in both directions', () => {
		isExternal.mockReturnValue(true);
		expect(bulkLimitForHost(true, 1, 2)).toBe(2);
		isExternal.mockReturnValue(false);
		expect(bulkLimitForHost(false, 1, 2)).toBe(1);
	});

	it('falls back to the hostname only while the probe is unresolved', () => {
		isExternal.mockReturnValue(true);
		expect(bulkLimitForHost(undefined, 1, 2)).toBe(1);
		isExternal.mockReturnValue(false);
		expect(bulkLimitForHost(undefined, 1, 2)).toBe(2);
	});
});

describe('the two batch ceilings', () => {
	beforeEach(() => isExternal.mockReturnValue(false));

	it('pair each limit with its own host', () => {
		expect(bulkIterationsLimit(false)).toBe(WEB_ITERATIONS_LIMIT);
		expect(bulkIterationsLimit(true)).toBe(NATIVE_ITERATIONS_LIMIT);
		expect(bulkCombinationsLimit(false)).toBe(WEB_COMBINATIONS_LIMIT);
		expect(bulkCombinationsLimit(true)).toBe(NATIVE_COMBINATIONS_LIMIT);
	});
});
