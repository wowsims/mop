import { ErrorOutcome, ErrorOutcomeType, RaidSimRequest, RaidSimResult } from '@generated/proto/api';
import { Profession } from '@generated/proto/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Gear } from './proto_utils/gear';
import { Sim, SimError } from './sim';
import type { Env } from './state/env';

const mocks = vi.hoisted(() => ({
	raidSimAsync: vi.fn(),
	runConcurrentSim: vi.fn(),
	isWasm: vi.fn(() => Promise.resolve(false)),
	getNumWorkers: vi.fn(() => 1),
}));

vi.mock('./worker_pool', () => ({
	generateRequestId: () => 'test-request',
	WorkerPool: class {
		setNumWorkers() {}
		getNumWorkers = mocks.getNumWorkers;
		isWasm = mocks.isWasm;
		raidSimAsync = mocks.raidSimAsync;
		computeStats = () => new Promise(() => {});
	},
}));

vi.mock('./wasm', () => ({
	runConcurrentBulkSim: vi.fn(),
	runConcurrentSim: mocks.runConcurrentSim,
	runConcurrentStatWeights: vi.fn(),
}));

vi.mock('./proto_utils/database', () => ({
	Database: { get: () => Promise.resolve({}) },
}));

const makeEnv = (): Env => ({
	storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
	location: { hash: '', search: '', href: 'http://localhost/', hostname: 'localhost', setHash: () => {} },
	hardwareConcurrency: 1,
	onPageHide: () => () => {},
});

// A stand-in for the request `makeRaidSimRequest` builds: every option the merged call acts on is
// read back off the request or the player, so stubbing it keeps the assertions on the option
// handling rather than on proto assembly.
const makeRequest = (iterations: number, profession = Profession.ProfessionUnknown) =>
	RaidSimRequest.create({
		raid: { parties: [{ players: [{ profession1: profession }] }] },
		simOptions: { iterations },
	});

const makeGear = (label: string) =>
	({
		withoutBlacksmithSockets: vi.fn(() => makeGear(`${label}-stripped`)),
		toDatabase: vi.fn(() => ({ label })),
		asSpec: vi.fn(() => ({ label })),
	}) as unknown as Gear;

const runningSignals = (sim: Sim) => (sim.signalManager as unknown as { running: Map<unknown, unknown> }).running;

const makeSim = ({ iterations = 100, profession = Profession.ProfessionUnknown, concurrent = false } = {}) => {
	const sim = new Sim({ env: makeEnv() });
	vi.spyOn(sim.raid, 'isEmpty').mockReturnValue(false);
	vi.spyOn(sim.encounter, 'getTargets').mockReturnValue([{}] as any);
	vi.spyOn(sim, 'waitForInit').mockResolvedValue();
	vi.spyOn(sim, 'shouldUseWasmConcurrency').mockResolvedValue(concurrent);
	vi.spyOn(sim, 'makeRaidSimRequest').mockImplementation(() => makeRequest(iterations, profession));
	return sim;
};

describe('Sim.runSim', () => {
	beforeEach(() => {
		mocks.raidSimAsync.mockReset().mockResolvedValue(RaidSimResult.create());
		mocks.runConcurrentSim.mockReset().mockResolvedValue(RaidSimResult.create());
	});

	it('rejects before registering anything when the raid is empty', async () => {
		const sim = makeSim();
		vi.spyOn(sim.raid, 'isEmpty').mockReturnValue(true);

		await expect(sim.runSim({ raw: true })).rejects.toThrow('Raid is empty!');
		expect(runningSignals(sim).size).toBe(0);
		expect(mocks.raidSimAsync).not.toHaveBeenCalled();
	});

	it('rejects when the encounter has no targets', async () => {
		const sim = makeSim();
		vi.spyOn(sim.encounter, 'getTargets').mockReturnValue([]);

		await expect(sim.runSim({ raw: true })).rejects.toThrow('Encounter has no targets!');
	});

	it('substitutes the gear option onto the player, stripping blacksmith sockets for a non-blacksmith', async () => {
		const sim = makeSim();
		const gear = makeGear('gear');

		await sim.runSim({ gear, raw: true });

		expect(gear.withoutBlacksmithSockets).toHaveBeenCalled();
		const [request] = mocks.raidSimAsync.mock.calls[0];
		const player = request.raid.parties[0].players[0];
		expect(player.database).toEqual({ label: 'gear-stripped' });
		expect(player.equipment).toEqual({ label: 'gear-stripped' });
	});

	it('keeps the blacksmith sockets when the player is a blacksmith', async () => {
		const sim = makeSim({ profession: Profession.Blacksmithing });
		const gear = makeGear('gear');

		await sim.runSim({ gear, raw: true });

		expect(gear.withoutBlacksmithSockets).not.toHaveBeenCalled();
		const [request] = mocks.raidSimAsync.mock.calls[0];
		expect(request.raid.parties[0].players[0].database).toEqual({ label: 'gear' });
	});

	it('leaves the player untouched when no gear option is given', async () => {
		const sim = makeSim();

		await sim.runSim({ raw: true });

		const [request] = mocks.raidSimAsync.mock.calls[0];
		const player = request.raid.parties[0].players[0];
		expect(player.database).toBeUndefined();
		expect(player.equipment).toBeUndefined();
	});

	it('returns the raw request/result pair without building or emitting a SimResult', async () => {
		const sim = makeSim();
		const result = RaidSimResult.create();
		mocks.raidSimAsync.mockResolvedValue(result);
		const emitted = vi.fn();
		sim.simResultEmitter.on(emitted);

		const returned = await sim.runSim({ raw: true });

		expect(Array.isArray(returned)).toBe(true);
		const [request, raw] = returned as [RaidSimRequest, RaidSimResult];
		expect(request).toBe(mocks.raidSimAsync.mock.calls[0][0]);
		expect(raw).toBe(result);
		expect(emitted).not.toHaveBeenCalled();
	});

	it('returns an aborted outcome instead of throwing, and unregisters its signals', async () => {
		const sim = makeSim();
		const aborted = RaidSimResult.create({ error: ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted, message: 'aborted' }) });
		mocks.raidSimAsync.mockResolvedValue(aborted);

		const returned = await sim.runSim();

		expect(returned).toBe(aborted.error);
		expect(runningSignals(sim).size).toBe(0);
	});

	it('still throws a SimError for a real error outcome', async () => {
		const sim = makeSim();
		mocks.raidSimAsync.mockResolvedValue(
			RaidSimResult.create({ error: ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeError, message: 'boom' }) }),
		);

		await expect(sim.runSim()).rejects.toThrow(SimError);
		expect(runningSignals(sim).size).toBe(0);
	});

	it('does not split a single iteration across workers even with wasm concurrency available', async () => {
		const sim = makeSim({ iterations: 1, concurrent: true });

		await sim.runSim({ singleIteration: true, raw: true });

		expect(mocks.raidSimAsync).toHaveBeenCalledTimes(1);
		expect(mocks.runConcurrentSim).not.toHaveBeenCalled();
	});

	it('splits a multi-iteration run when wasm concurrency is available', async () => {
		const sim = makeSim({ iterations: 100, concurrent: true });

		await sim.runSim({ raw: true });

		expect(mocks.runConcurrentSim).toHaveBeenCalledTimes(1);
		expect(mocks.raidSimAsync).not.toHaveBeenCalled();
	});

	it('passes a no-op progress callback through when the option is omitted', async () => {
		const sim = makeSim();

		await sim.runSim({ raw: true });

		expect(typeof mocks.raidSimAsync.mock.calls[0][1]).toBe('function');
		expect(() => mocks.raidSimAsync.mock.calls[0][1]({})).not.toThrow();
	});

	it('forwards the progress callback option to the worker', async () => {
		const sim = makeSim();
		const onProgress = vi.fn();

		await sim.runSim({ onProgress, raw: true });

		expect(mocks.raidSimAsync.mock.calls[0][1]).toBe(onProgress);
	});
});
