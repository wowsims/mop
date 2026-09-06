import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `Database.get` memoises its load in module scope, so every case resets the module registry to get
// a fresh memo rather than sharing one across tests.
const freshDatabase = async () => {
	vi.resetModules();
	return (await import('./database')).Database;
};

const okResponse = () => ({ json: () => Promise.resolve({}) });

describe('Database.get', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('retries a failing load before giving up', async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(okResponse());
		vi.stubGlobal('fetch', fetchMock);

		const Database = await freshDatabase();
		const loaded = Database.get();
		await vi.runAllTimersAsync();

		await expect(loaded).resolves.toBeDefined();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	// The regression this exists for: the memo used to hold the rejected promise for the page
	// lifetime, so every later caller awaited the same failure and the app could not recover.
	it('does not memoize a failure — a later call tries again and can succeed', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
		vi.stubGlobal('fetch', fetchMock);

		const Database = await freshDatabase();
		const first = Database.get();
		await vi.runAllTimersAsync();
		await expect(first).rejects.toThrow('offline');

		const attemptsWhileFailing = fetchMock.mock.calls.length;
		fetchMock.mockResolvedValue(okResponse());

		const second = Database.get();
		await vi.runAllTimersAsync();
		await expect(second).resolves.toBeDefined();
		expect(fetchMock.mock.calls.length).toBeGreaterThan(attemptsWhileFailing);
	});

	it('shares one load between concurrent callers', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okResponse());
		vi.stubGlobal('fetch', fetchMock);

		const Database = await freshDatabase();
		const [a, b] = await Promise.all([Database.get(), Database.get()]);

		expect(a).toBe(b);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
