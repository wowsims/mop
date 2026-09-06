import { afterEach, describe, expect, it, vi } from 'vitest';

// `Database.get` memoises its load in module scope, so every case resets the module registry to get
// a fresh memo rather than sharing one across tests.
// Fake timers are installed *after* the dynamic import, not in `beforeEach`: the module loader's own
// microtasks run on a frozen clock otherwise, and the retry case fails intermittently.
const freshDatabase = async () => {
	vi.resetModules();
	const { Database } = await import('./database');
	vi.useFakeTimers();
	return Database;
};

const okResponse = () => ({ json: () => Promise.resolve({}) });

// `runAllTimersAsync` drains what is scheduled when it is called; the retry schedules its next
// backoff from inside a rejection handler, so under load the third attempt can be scheduled after
// the drain has already finished. Advancing until the call count settles is deterministic.
const drainRetries = async (fetchMock: { mock: { calls: unknown[] } }, until: number) => {
	for (let i = 0; i < 20 && fetchMock.mock.calls.length < until; i++) await vi.advanceTimersByTimeAsync(1000);
};

describe('Database.get', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('retries a failing load before giving up', async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(okResponse());
		vi.stubGlobal('fetch', fetchMock);

		const Database = await freshDatabase();
		const loaded = expect(Database.get()).resolves.toBeDefined();
		await drainRetries(fetchMock, 3);
		await loaded;

		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	// The regression this exists for: the memo used to hold the rejected promise for the page
	// lifetime, so every later caller awaited the same failure and the app could not recover.
	it('does not memoize a failure — a later call tries again and can succeed', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
		vi.stubGlobal('fetch', fetchMock);

		const Database = await freshDatabase();
		// The assertion is attached before the timers run: `get()` rejects while they are draining,
		// and a rejection with no handler yet attached surfaces as an unhandled rejection.
		const first = expect(Database.get()).rejects.toThrow('offline');
		await drainRetries(fetchMock, 3);
		await first;

		const attemptsWhileFailing = fetchMock.mock.calls.length;
		fetchMock.mockResolvedValue(okResponse());

		const attemptsBeforeSecond = fetchMock.mock.calls.length;
		const second = expect(Database.get()).resolves.toBeDefined();
		await drainRetries(fetchMock, attemptsBeforeSecond + 1);
		await second;
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
