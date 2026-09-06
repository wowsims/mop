// The tail three importers share. Two things here are behaviour rather than plumbing: the class
// guard, which now reaches the caller instead of becoming an unhandled rejection, and which of the
// two closing toasts is shown.
import { classNames } from '@domain/proto_utils/names';
import type { IndividualSimHost } from '@features/sim_host';
import { Class, EquipmentSpec, Glyphs, Profession, Race } from '@generated/proto/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { finishIndividualImport } from './finish_individual_import';

const loadLeftovers = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@domain/proto_utils/database', () => ({ Database: { loadLeftoversIfNecessary: loadLeftovers } }));

// The real one gates store notifications; here it only has to run the body.
vi.mock('@domain/state/batch', () => ({ batch: (body: () => void) => body() }));

const toasts = vi.hoisted(() => [] as Array<{ variant: string; body: unknown }>);
vi.mock('@ui-kit/toast', () => ({
	default: class {
		constructor(options: { variant: string; body: unknown }) {
			toasts.push(options);
		}
	},
}));

const player = {
	getClass: () => Class.ClassWarrior,
	getPlayerClass: () => ({ friendlyName: 'Warrior' }),
	setRace: vi.fn(),
	setGear: vi.fn(),
	setTalentsString: vi.fn(),
	setGlyphs: vi.fn(),
	setProfessions: vi.fn(),
};
const host = { player, sim: { db: { lookupEquipmentSpec: vi.fn(() => 'the gear') } } } as unknown as IndividualSimHost<any>;

const parsed = (overrides: Partial<Parameters<typeof finishIndividualImport>[1]> = {}) => ({
	charClass: Class.ClassWarrior,
	race: Race.RaceHuman,
	equipmentSpec: EquipmentSpec.create(),
	talentsStr: '312231',
	glyphs: null,
	professions: [],
	...overrides,
});

describe('finishIndividualImport', () => {
	beforeEach(() => {
		toasts.length = 0;
		for (const setter of [player.setRace, player.setGear, player.setTalentsString, player.setGlyphs, player.setProfessions]) setter.mockClear();
	});

	// The fix: all three vanilla callers invoked this without `await`, so this rejection was
	// unhandled — the import silently did nothing.
	it('rejects when the export is for another class, before touching the player', async () => {
		await expect(finishIndividualImport(host, parsed({ charClass: Class.ClassMage }))).rejects.toThrow(
			`Wrong Class! Expected Warrior but found ${classNames.get(Class.ClassMage)}!`,
		);
		expect(player.setRace).not.toHaveBeenCalled();
		expect(loadLeftovers).not.toHaveBeenCalled();
	});

	it('applies race, gear, talents, glyphs and professions, and reports success', async () => {
		const glyphs = Glyphs.create({ major1: 1 });
		await finishIndividualImport(host, parsed({ glyphs, professions: [Profession.Engineering] }));

		expect(player.setRace).toHaveBeenCalledWith(Race.RaceHuman);
		expect(player.setGear).toHaveBeenCalledWith('the gear');
		expect(player.setTalentsString).toHaveBeenCalledWith('312231');
		expect(player.setGlyphs).toHaveBeenCalledWith(glyphs);
		expect(player.setProfessions).toHaveBeenCalledWith([Profession.Engineering]);
		expect(toasts).toEqual([{ variant: 'success', body: 'Import successful!' }]);
	});

	// `--` is what an empty MoP talent string looks like, and writing it would wipe the talents the
	// import did not carry.
	it('leaves the talents alone for an empty talent string', async () => {
		await finishIndividualImport(host, parsed({ talentsStr: '--' }));
		expect(player.setTalentsString).not.toHaveBeenCalled();
	});

	it('lists what the database did not have', async () => {
		await finishIndividualImport(host, parsed({ missingItems: [1, 2], missingEnchants: [3] }));
		expect(toasts).toEqual([
			{
				variant: 'info',
				body: 'Import successful, but the following IDs were not found in the sim database:\n\nItems: 1, 2\n\nEnchants: 3',
			},
		]);
	});
});
