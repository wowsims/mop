import { InputType, PresetTarget, Target as TargetProto, TargetInput } from '@generated/proto/common';
import type { Encounter } from '@sim/raid/encounter';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TargetsPicker } from './TargetsPicker';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => Array.from(listeners).forEach(listener => listener()),
	};
});
vi.mock('@sim/state/subscriptions', () => ({ subscribeEncounterField: () => source.subscribe }));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@i18n/localization', () => ({
	translateItemLabel: (label: string) => label,
	translateMobType: (value: number) => `mob-${value}`,
	translateSpellSchool: (value: number) => `school-${value}`,
	translateStat: (value: number) => `stat-${value}`,
	translateTargetInputLabel: (label: string) => label,
	translateTargetInputTooltip: (_label: string, tooltip: string) => tooltip,
}));
const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));

const defaultTarget = () => TargetProto.create({ level: 93, swingSpeed: 2 });

/** Stands in for the `Encounter` facade: the seven members the target pickers reach for. */
class FakeEncounter {
	constructor(
		public targets: Array<TargetProto> = [defaultTarget()],
		public presetTargets: Array<PresetTarget> = [],
	) {}
	readonly sim = { db: { getAllPresetTargets: () => this.presetTargets } };
	getTargets() {
		return this.targets;
	}
	getTarget(index: number) {
		return this.targets[index];
	}
	setTargets(next: Array<TargetProto>) {
		this.targets = next;
		source.notify();
	}
	modifyTarget(index: number, apply: (target: TargetProto) => void) {
		const draft = TargetProto.clone(this.targets[index]);
		apply(draft);
		this.targets = this.targets.map((target, at) => (at === index ? draft : target));
		source.notify();
	}
	applyPresetTarget() {
		/* no preset targets in this fixture */
	}
}

const mount = (encounter: FakeEncounter) => render(<TargetsPicker encounter={encounter as unknown as Encounter} />);

const root = () => document.querySelector('.list-picker-root') as HTMLElement;
const targetRoots = () => [...document.querySelectorAll<HTMLElement>('.target-picker-root')];
const containers = () => [...root().querySelectorAll<HTMLElement>('.list-picker-item-container')];
const actionsButton = (index: number) => containers()[index].querySelector('.list-picker-item-actions') as HTMLButtonElement;
const idsIn = (element: Element) => [...element.querySelectorAll('[id]')].map(node => node.id);

beforeEach(() => {
	source.listeners.clear();
	trackEvent.mockClear();
});

describe('TargetsPicker', () => {
	it('wears the classes the encounter stylesheet and the encounter gate select on', () => {
		mount(new FakeEncounter());

		expect(root().className.split(' ').sort()).toEqual(['input-root', 'list-picker-root', 'mb-0', 'targets-picker']);
		expect(targetRoots()).toHaveLength(1);
		expect([...targetRoots()[0].querySelectorAll('.target-picker-section')].map(section => section.className)).toEqual([
			'picker-group target-picker-section target-picker-section1',
			'picker-group target-picker-section target-picker-section2',
			'picker-group target-picker-section target-picker-section3 threat-metrics',
		]);
	});

	it('renders one target row per target and adds another through the create button', () => {
		const encounter = new FakeEncounter();
		mount(encounter);
		expect(targetRoots()).toHaveLength(1);

		act(() => encounter.setTargets([defaultTarget(), defaultTarget()]));
		expect(targetRoots()).toHaveLength(2);
	});

	it('withholds delete from the first target, because an encounter needs one', () => {
		const encounter = new FakeEncounter([defaultTarget(), defaultTarget()]);
		mount(encounter);

		fireEvent.click(actionsButton(0));
		expect(containers()[0].querySelector('.list-picker-item-popover')).not.toBeNull();
		expect(containers()[0].querySelector('.list-picker-item-delete')).toBeNull();
		fireEvent.click(actionsButton(1));
		expect(containers()[1].querySelector('.list-picker-item-delete')).not.toBeNull();
	});

	it('removes a target through the menu and reports it as a remove-target event', () => {
		const encounter = new FakeEncounter([defaultTarget(), defaultTarget()]);
		mount(encounter);

		fireEvent.click(actionsButton(1));
		act(() => void fireEvent.click(containers()[1].querySelector('.list-picker-item-delete')!));

		expect(encounter.targets).toHaveLength(1);
		expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ label: 'remove-target' }));
	});

	it('gives every target its own picker ids', () => {
		mount(new FakeEncounter([defaultTarget(), defaultTarget()]));

		const [first, second] = targetRoots().map(idsIn);
		expect(first.length).toBeGreaterThan(10);
		expect(first).toEqual(expect.arrayContaining(['target-0-picker-npc', 'target-0-picker-level', 'target-0-picker-spell-school']));
		expect(second).toEqual(expect.arrayContaining(['target-1-picker-npc', 'target-1-picker-level', 'target-1-picker-spell-school']));
		expect(first.filter(id => second.includes(id))).toEqual([]);
	});

	it('reads each target row from its own index rather than from the first', () => {
		const encounter = new FakeEncounter([TargetProto.create({ level: 93 }), TargetProto.create({ level: 88 })]);
		mount(encounter);

		const levelOf = (index: number) => (targetRoots()[index].querySelector('#target-' + index + '-picker-level') as HTMLSelectElement).value;
		expect(levelOf(0)).toBe('93');
		expect(levelOf(1)).toBe('88');
	});

	it('writes a level change back to the target it belongs to', () => {
		const encounter = new FakeEncounter([TargetProto.create({ level: 93 }), TargetProto.create({ level: 93 })]);
		mount(encounter);

		const select = targetRoots()[1].querySelector('#target-1-picker-level') as HTMLSelectElement;
		act(() => void fireEvent.change(select, { target: { value: '88' } }));

		expect(encounter.targets.map(target => target.level)).toEqual([93, 88]);
	});

	it('disables the dual-wield miss penalty until dual wield is on', () => {
		const encounter = new FakeEncounter([TargetProto.create({ dualWield: false })]);
		mount(encounter);
		const penalty = () => document.querySelector('#target-0-picker-dw-miss-penalty')!.closest('.input-root')!;
		expect(penalty().classList.contains('disabled')).toBe(true);

		act(() => encounter.modifyTarget(0, target => (target.dualWield = true)));
		expect(penalty().classList.contains('disabled')).toBe(false);
	});

	// Encounters register a preset per raid size and difficulty, all sharing one npc id — which is
	// this picker's value, and all the sim resolves an AI from.
	describe('AI options', () => {
		const preset = (path: string, id: number) => PresetTarget.create({ path, target: TargetProto.create({ id }) });
		const aiOptions = () => [...document.querySelectorAll<HTMLOptionElement>('.ai-picker option')].map(option => option.value);

		it('offers one option per npc id, however many presets share it', () => {
			mount(
				new FakeEncounter(
					[defaultTarget()],
					[preset('Throne of Thunder/Horridon 25 H', 68476), preset('Throne of Thunder/Horridon 10 H', 68476), preset('x/Jalak', 69374)],
				),
			);

			expect(aiOptions()).toEqual(['0', '68476', '69374']);
		});

		it('keeps the preset the sim resolves the id to, which is the first one registered', () => {
			mount(new FakeEncounter([defaultTarget()], [preset('first', 71466), preset('second', 71466)]));

			expect([...document.querySelectorAll<HTMLOptionElement>('.ai-picker option')].map(option => option.textContent)).toEqual(['common.none', 'first']);
		});
	});

	describe('target inputs', () => {
		const withInputs = () =>
			new FakeEncounter([
				TargetProto.create({
					targetInputs: [
						TargetInput.create({ label: 'Stacks', inputType: InputType.Number, numberValue: 3 }),
						TargetInput.create({ label: 'Enraged', inputType: InputType.Bool, boolValue: true }),
						TargetInput.create({ label: 'Phase', inputType: InputType.Enum, enumValue: 1, enumOptions: ['One', 'Two'] }),
					],
				}),
			]);

		it('renders one picker per input, dispatched on its declared type', () => {
			mount(withInputs());
			const inputRoots = [...document.querySelectorAll('.target-input-picker-root')];

			expect(inputRoots).toHaveLength(3);
			expect(inputRoots.map(node => node.firstElementChild!.className.split(' ')[1])).toEqual([
				'number-picker-root',
				'boolean-picker-root',
				'enum-picker-root',
			]);
		});

		it('shows each input its own value', () => {
			mount(withInputs());
			const inputRoots = [...document.querySelectorAll('.target-input-picker-root')];

			// `float: true`, so the number box shows two decimals.
			expect(inputRoots[0].querySelector('input')!.value).toBe('3.00');
			expect(inputRoots[1].querySelector('input')!.checked).toBe(true);
			expect(inputRoots[2].querySelector('select')!.value).toBe('1');
		});

		it('offers no add, delete, copy or drag on the inputs list, which the AI owns', () => {
			mount(withInputs());
			const list = document.querySelector('.list-picker-compact')!;

			expect(list.querySelector('.list-picker-new-button')).toBeNull();
			expect(list.querySelector('.list-picker-item-actions')).toBeNull();
			expect([...list.querySelectorAll('.list-picker-item-container')].every(item => !item.classList.contains('draggable'))).toBe(true);
		});

		it('writes a number input back to its own index', () => {
			const encounter = withInputs();
			mount(encounter);
			const numberInput = document.querySelectorAll('.target-input-picker-root')[0].querySelector('input')!;

			act(() => void fireEvent.change(numberInput, { target: { value: '7' } }));

			expect(encounter.targets[0].targetInputs.map(input => input.numberValue)).toEqual([7, 0, 0]);
		});
	});
});
