// The vanilla panel's sixteen recorded defects are the reason most of these assertions exist; each
// one that fixes a defect says so. The store, the worker and the saved-data manager are stubbed —
// what is under test is the view, and every source it reads is driven directly.
import { Stats, UnitStat } from '@domain/proto_utils/stats';
import { SimHostProvider } from '@features/SimHostContext';
import { ErrorOutcomeType, type StatWeightsResult } from '@generated/proto/api';
import { Class, PseudoStat, Stat } from '@generated/proto/common';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyStatWeightsResult } from '../../model/ep_math';
import { EpWeightsOpener } from '../../model/ep_weights_opener';
import { EpWeightsDialog } from './EpWeightsDialog';

const source = vi.hoisted(() => {
	const listeners = new Map<string, Set<() => void>>();
	return {
		listeners,
		subscribe: (key: string) => (onChange: () => void) => {
			const set = listeners.get(key) ?? new Set<() => void>();
			listeners.set(key, set);
			set.add(onChange);
			return () => set.delete(onChange);
		},
		notify: (key: string) => listeners.get(key)?.forEach(listener => listener()),
		count: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
	};
});

vi.mock('@domain/state/subscriptions', () => ({
	subscribePlayerField: (_player: unknown, field: string) => source.subscribe(`player:${field}`),
	subscribeUiField: (_sim: unknown, field: string) => source.subscribe(`ui:${field}`),
	subscribeStatWeightsChange: () => source.subscribe('statWeights'),
}));

// Real stat names, because the vitest i18n stub answers with the enum key and the id-sanitising
// defect is about the spaces a real name has.
const STAT_NAMES: Partial<Record<Stat, string>> = {
	[Stat.StatStrength]: 'Strength',
	[Stat.StatAgility]: 'Agility',
	[Stat.StatCritRating]: 'Crit Rating',
};
vi.mock('@i18n/localization', () => ({
	translateStat: (stat: Stat) => STAT_NAMES[stat] ?? `Stat ${stat}`,
	translatePseudoStat: (pseudoStat: PseudoStat) => (pseudoStat === PseudoStat.PseudoStatSpellHitPercent ? 'Spell Hit Percent' : `Pseudo ${pseudoStat}`),
}));

vi.mock('../../view/saved_ep_weights', () => ({ renderSavedEPWeights: () => undefined }));

// The vitest i18n stub has no resources, so `t` answers with the key and never interpolates — which
// would make the reference-stat half of a column tooltip invisible. This keeps the key and shows the
// interpolation beside it.
vi.mock('@i18n/config', () => ({
	default: { t: (key: string, options?: Record<string, unknown>) => (options?.refStatName ? `${key}[${options.refStatName}]` : key) },
}));

const toasts = vi.hoisted(() => [] as Array<{ variant: string; body: unknown }>);
vi.mock('@ui-kit/toast', () => ({
	default: class {
		constructor(options: { variant: string; body: unknown }) {
			toasts.push(options);
		}
	},
}));
const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));

const STRENGTH = UnitStat.fromStat(Stat.StatStrength);
const AGILITY = UnitStat.fromStat(Stat.StatAgility);

class FakePlayer {
	epWeights = new Stats();
	epRatios = [1, 0, 0, 0, 0, 0];
	readonly playerClass = { classID: Class.ClassWarrior };
	computeStatWeights = vi.fn<(...args: any[]) => Promise<StatWeightsResult>>();

	getClass() {
		return Class.ClassWarrior;
	}
	getEpWeights() {
		return this.epWeights;
	}
	setEpWeights(weights: Stats) {
		this.epWeights = weights;
		source.notify('player:epWeights');
	}
	getEpRatios() {
		return this.epRatios.slice();
	}
	setEpRatios(ratios: number[]) {
		this.epRatios = ratios;
		source.notify('player:epRatios');
	}
}

class FakeSettings {
	excludedStats: Stat[] = [];
	excludedPseudoStats: PseudoStat[] = [];

	isStatExcludedFromCalc(stat: Stat) {
		return this.excludedStats.includes(stat);
	}
	isPseudoStatExcludedFromCalc(pseudoStat: PseudoStat) {
		return this.excludedPseudoStats.includes(pseudoStat);
	}
	isUnitStatExcludedFromCalc(stat: UnitStat) {
		return stat.isStat() ? this.isStatExcludedFromCalc(stat.getStat()) : this.isPseudoStatExcludedFromCalc(stat.getPseudoStat());
	}
	setStatExcluded(stat: UnitStat, exclude: boolean) {
		const list = stat.isStat() ? this.excludedStats : this.excludedPseudoStats;
		const value = stat.isStat() ? stat.getStat() : stat.getPseudoStat();
		const at = list.indexOf(value as never);
		if (exclude && at === -1) list.push(value as never);
		if (!exclude && at !== -1) list.splice(at, 1);
		source.notify('statWeights');
	}
}

const rootElem = document.createElement('div');
rootElem.className = 'sim-ui';

let player: FakePlayer;
let settings: FakeSettings;
let opener: EpWeightsOpener;
let host: any;
let abortType: ReturnType<typeof vi.fn>;

// The server returns `epValues` already normalised by `epReferenceStat`; `calculateEp` only
// re-normalises when the user has picked a different reference stat.
const weightsResult = (values: Array<[UnitStat, number]>): StatWeightsResult => {
	const result = emptyStatWeightsResult();
	const reference = values.find(([stat]) => stat.equalsStat(Stat.StatStrength))?.[1] ?? 1;
	for (const [stat, value] of values) {
		stat.setProtoValue(result.dps!.weights!, value);
		stat.setProtoValue(result.dps!.epValues!, value / reference);
	}
	return result;
};

const setup = () => {
	source.listeners.clear();
	toasts.length = 0;
	player = new FakePlayer();
	settings = new FakeSettings();
	opener = new EpWeightsOpener();
	abortType = vi.fn().mockResolvedValue(undefined);
	const refStats: { dps?: Stat; heal?: Stat; tank?: Stat } = {};
	host = {
		rootElem,
		player,
		sim: {
			showThreatMetrics: false,
			getShowThreatMetrics() {
				return this.showThreatMetrics;
			},
			getIterations: () => 1000,
			signalManager: { abortType },
		},
		individualConfig: {
			epStats: [Stat.StatStrength, Stat.StatAgility, Stat.StatCritRating],
			epPseudoStats: [PseudoStat.PseudoStatSpellHitPercent],
			epReferenceStat: Stat.StatStrength,
			defaults: { epWeights: new Stats().withStat(Stat.StatAgility, 7) },
		},
		get dpsRefStat() {
			return refStats.dps;
		},
		set dpsRefStat(value: Stat | undefined) {
			refStats.dps = value;
			source.notify('player:epRefStat');
		},
		get healRefStat() {
			return refStats.heal;
		},
		set healRefStat(value: Stat | undefined) {
			refStats.heal = value;
			source.notify('player:epRefStat');
		},
		get tankRefStat() {
			return refStats.tank;
		},
		set tankRefStat(value: Stat | undefined) {
			refStats.tank = value;
			source.notify('player:epRefStat');
		},
	};
};

const renderDialog = () => {
	document.body.appendChild(rootElem);
	const result = render(
		<SimHostProvider host={host}>
			<EpWeightsDialog opener={opener} settings={settings as never} />
		</SimHostProvider>,
	);
	act(() => opener.open());
	return result;
};

const popup = () => rootElem.querySelector('.ep-weights-menu')!;
const table = () => popup().querySelector('table.results-ep-table')!;
const rowFor = (name: string) => [...table().querySelectorAll('tbody tr')].find(row => row.firstElementChild?.textContent === name)!;
const calculate = () => popup().querySelector<HTMLButtonElement>('button.calc-weights')!;

describe('EpWeightsDialog', () => {
	beforeEach(setup);

	it('builds the column set in order, with the metric and type classes each rule selects on', () => {
		renderDialog();
		const headers = [...table().querySelectorAll('thead tr:first-child th')];
		expect(headers.map(th => th.textContent)).toEqual([
			'sidebar.buttons.stat_weights.modal.column_headers.stat',
			'sidebar.buttons.stat_weights.modal.column_headers.update',
			'sidebar.buttons.stat_weights.modal.dps_weight.label',
			'sidebar.buttons.stat_weights.modal.dps_ep.label',
			'sidebar.buttons.stat_weights.modal.hps_weight.label',
			'sidebar.buttons.stat_weights.modal.hps_ep.label',
			'sidebar.buttons.stat_weights.modal.tps_weight.label',
			'sidebar.buttons.stat_weights.modal.tps_ep.label',
			'sidebar.buttons.stat_weights.modal.dtps_weight.label',
			'sidebar.buttons.stat_weights.modal.dtps_ep.label',
			'sidebar.buttons.stat_weights.modal.tmi_weight.label',
			'sidebar.buttons.stat_weights.modal.tmi_ep.label',
			'sidebar.buttons.stat_weights.modal.death_weight.label',
			'sidebar.buttons.stat_weights.modal.death_ep.label',
			'sidebar.buttons.stat_weights.modal.current_ep.label',
		]);
		expect(headers[2].className).toBe('damage-metrics type-weight');
		expect(headers[14].className).toBe('text-center');
	});

	it('shows the spec stats, and the rest only once Show all stats is on', () => {
		renderDialog();
		const names = () => [...table().querySelectorAll('tbody tr')].map(row => row.firstElementChild!.textContent);
		expect(names()).toEqual(['Strength', 'Agility', 'Crit Rating', 'Spell Hit Percent']);

		act(() => {
			fireEvent.click(popup().querySelector('#ep-show-all-stats')!);
		});
		expect(names().length).toBeGreaterThan(4);
	});

	it('switches the table between EP and weight columns', () => {
		renderDialog();
		expect(table().className).toBe('results-ep-table stats-type-ep');

		const select = popup().querySelector<HTMLSelectElement>('#ep-type-select')!;
		act(() => {
			select.value = '1';
			fireEvent.change(select);
		});
		expect(table().className).toBe('results-ep-table stats-type-weight');
	});

	// DEFECT FIXED. `makeEpRatioCell` was applied to the six EP cells and the six weight cells, both
	// indexed 0-5, so `ep-ratio-0`…`ep-ratio-5` each existed twice.
	it('gives every EP-ratio picker a unique id', () => {
		renderDialog();
		const ids = [...table().querySelectorAll('tr.ep-ratios input')].map(input => input.id);
		expect(ids).toHaveLength(12);
		expect(new Set(ids).size).toBe(12);
		expect(ids.slice(0, 2)).toEqual(['ep-ratio-weight-0', 'ep-ratio-ep-0']);
	});

	it('writes the ratio at its own index', () => {
		renderDialog();
		const input = table().querySelector<HTMLInputElement>('#ep-ratio-ep-2')!;
		act(() => {
			input.value = '0.5';
			fireEvent.change(input);
		});
		expect(player.epRatios).toEqual([1, 0, 0.5, 0, 0, 0]);
	});

	// DEFECT FIXED. The id was the untranslated full name, so it carried ASCII spaces — the line
	// below it in the same function already called `sanitizeId`.
	it('sanitises the include-toggle id', () => {
		renderDialog();
		expect(rowFor('Spell Hit Percent').querySelector('.swcalc-include-toggle input')!.id).toBe('sw-stat-toggle-spellhitpercent');
		expect(rowFor('Crit Rating').querySelector('.current-ep input')!.id).toBe('ep-weight-stat-crit');
	});

	it('leaves the reference stat out of the calculation and disables its toggle', () => {
		renderDialog();
		expect(rowFor('Strength').querySelector<HTMLInputElement>('.swcalc-include-toggle input')!.disabled).toBe(true);
		expect(rowFor('Agility').querySelector<HTMLInputElement>('.swcalc-include-toggle input')!.disabled).toBe(false);
	});

	it('renders no include toggle for a stat the spec does not weight', () => {
		renderDialog();
		act(() => {
			fireEvent.click(popup().querySelector('#ep-show-all-stats')!);
		});
		const unweighted = UnitStat.fromStat(Stat.StatStamina).getFullName(Class.ClassWarrior);
		expect(rowFor(unweighted)).toBeTruthy();
		expect(rowFor(unweighted).querySelector('.swcalc-include-toggle input')).toBeNull();
		expect(rowFor('Strength').querySelector('.swcalc-include-toggle input')).not.toBeNull();
	});

	// DEFECT FIXED. Every `<button>` in the panel was written without one, so any inside a form would
	// submit it.
	it('types every button it renders', () => {
		renderDialog();
		const buttons = [...rootElem.querySelectorAll('button')];
		expect(buttons.length).toBeGreaterThan(14);
		expect(buttons.filter(button => !button.getAttribute('type'))).toEqual([]);
	});

	// DEFECT FIXED. The three reference selects were named by an adjacent `<span>`, which is not an
	// accessible name at all.
	it('labels each reference select', () => {
		renderDialog();
		for (const id of ['ep-ref-stat-damage', 'ep-ref-stat-healing', 'ep-ref-stat-threat']) {
			const label = popup().querySelector<HTMLLabelElement>(`label[for="${id}"]`)!;
			expect(label).not.toBeNull();
			expect(label.textContent).not.toBe('');
			expect(popup().querySelector(`select#${id}`)).not.toBeNull();
		}
	});

	// DEFECT FIXED. The `<option>`s carried no `value`, so the selection round-tripped through the
	// translated display string.
	it('carries the stat enum on each reference option, and writes it', () => {
		renderDialog();
		const select = popup().querySelector<HTMLSelectElement>('#ep-ref-stat-damage')!;
		expect([...select.options].map(option => option.value)).toEqual([String(Stat.StatStrength), String(Stat.StatAgility), String(Stat.StatCritRating)]);
		expect(select.value).toBe(String(Stat.StatStrength));

		act(() => {
			select.value = String(Stat.StatAgility);
			fireEvent.change(select);
		});
		expect(host.dpsRefStat).toBe(Stat.StatAgility);
	});

	// DEFECT FIXED. tippy resolves a function-valued `content` once at creation, so the "normalized
	// by …" half of the label tooltip never followed a change of reference stat.
	it('follows the reference stat in the column tooltip', () => {
		renderDialog();
		const dpsEpLabel = () => table().querySelectorAll('thead tr:first-child th')[3].querySelector('span')!;
		expect(dpsEpLabel().getAttribute('data-tooltip-content')).toContain('Strength');

		const select = popup().querySelector<HTMLSelectElement>('#ep-ref-stat-damage')!;
		act(() => {
			select.value = String(Stat.StatAgility);
			fireEvent.change(select);
		});
		expect(dpsEpLabel().getAttribute('data-tooltip-content')).toContain('Agility');
		expect(dpsEpLabel().getAttribute('data-tooltip-content')).not.toContain('Strength');
	});

	// DEFECT FIXED. `getModalConfig` read `getShowThreatMetrics()` once, at construction.
	it('follows the threat-metrics toggle in the dialog size', () => {
		renderDialog();
		expect(popup().classList.contains('sim-dialog-popup--lg')).toBe(true);

		act(() => {
			host.sim.showThreatMetrics = true;
			source.notify('ui:showThreatMetrics');
		});
		expect(popup().classList.contains('sim-dialog-popup--xl')).toBe(true);
	});

	it('copies a column into the current EP weights, leaving excluded stats alone', () => {
		renderDialog();
		player.setEpWeights(new Stats().withStat(Stat.StatAgility, 3));
		settings.setStatExcluded(AGILITY, true);

		act(() => {
			fireEvent.click(table().querySelectorAll('thead tr:first-child th')[14].querySelector('button.col-action')!);
		});

		expect(player.epWeights.getStat(Stat.StatAgility)).toBe(3);
	});

	it('folds the ratios into the current EP weights on Update EP, per stats type', async () => {
		player.computeStatWeights.mockResolvedValue(
			weightsResult([
				[STRENGTH, 2],
				[AGILITY, 1],
			]),
		);
		renderDialog();
		await act(async () => {
			fireEvent.click(calculate());
		});
		player.setEpWeights(new Stats().withStat(Stat.StatStrength, 5));

		act(() => {
			fireEvent.click(table().querySelector('tr.ep-ratios button.compute-ep')!);
		});
		expect(player.epWeights.getStat(Stat.StatStrength)).toBe(1);
		expect(player.epWeights.getStat(Stat.StatAgility)).toBe(0.5);

		const select = popup().querySelector<HTMLSelectElement>('#ep-type-select')!;
		act(() => {
			select.value = '1';
			fireEvent.change(select);
		});
		act(() => {
			fireEvent.click(table().querySelector('tr.ep-ratios button.compute-ep')!);
		});
		expect(player.epWeights.getStat(Stat.StatStrength)).toBe(2);
		expect(player.epWeights.getStat(Stat.StatAgility)).toBe(1);
	});

	describe('calculating', () => {
		it('runs, shows progress, and fills the table', async () => {
			let report: ((metrics: any) => void) | null = null;
			let finish: ((result: StatWeightsResult) => void) | null = null;
			player.computeStatWeights.mockImplementation(
				(_stats, _pseudo, _ref, onProgress) =>
					new Promise(resolve => {
						report = onProgress;
						finish = resolve;
					}),
			);
			renderDialog();

			await act(async () => {
				fireEvent.click(calculate());
			});
			expect(trackEvent).toHaveBeenCalledWith({ action: 'sim', category: 'stat_weights', label: 'calculate' });
			expect(player.computeStatWeights).toHaveBeenCalledWith(
				[Stat.StatStrength, Stat.StatAgility, Stat.StatCritRating],
				[PseudoStat.PseudoStatSpellHitPercent],
				Stat.StatStrength,
				expect.any(Function),
			);

			const progress = rootElem.querySelector('.progress-tracker-dialog')!;
			expect(progress.hasAttribute('hidden')).toBe(false);
			expect(popup().hasAttribute('hidden')).toBe(false);
			// Read off the *outer* popup: Base UI counts the dialogs nested inside it, and it only counts
			// this one because the progress dialog is rendered among the EP dialog's own children. A
			// sibling would leave it at 0 and make the inner backdrop an outside press on the outer.
			expect((popup() as HTMLElement).style.getPropertyValue('--nested-dialogs')).toBe('1');

			act(() => report!({ completedSims: 2, totalSims: 8, completedIterations: 250, totalIterations: 1000 }));
			expect(progress.querySelector('.progress-tracker-modal-progress-text')!.textContent).toBe('250/1000');
			expect(progress.querySelector('.progress-tracker-modal-progress-title')!.textContent).toContain('2 / 8');

			await act(async () =>
				finish!(
					weightsResult([
						[STRENGTH, 2],
						[AGILITY, 1],
					]),
				),
			);

			expect(rootElem.querySelector('.progress-tracker-dialog')).toBeNull();
			const strength = rowFor('Strength');
			expect(strength.querySelector('.type-weight .results-avg')!.textContent).toBe('2.00');
			expect(strength.querySelector('.type-ep .results-avg')!.textContent).toBe('1.00');
			expect(rowFor('Agility').querySelector('.type-ep .results-avg')!.textContent).toBe('0.50');
		});

		// DEFECT FIXED. The delta test was `if (…) epAvgElem;` — an expression statement that does
		// nothing, so a column at its current EP was styled as a change.
		it('marks the EP cell against the current weight, and not at all when they match', async () => {
			player.computeStatWeights.mockResolvedValue(
				weightsResult([
					[STRENGTH, 2],
					[AGILITY, 1],
				]),
			);
			renderDialog();
			player.setEpWeights(new Stats().withStat(Stat.StatAgility, 0.5));

			await act(async () => {
				fireEvent.click(calculate());
			});

			expect(rowFor('Strength').querySelector('.type-ep .results-avg')!.className).toBe('results-avg positive');
			expect(rowFor('Agility').querySelector('.type-ep .results-avg')!.className).toBe('results-avg');

			act(() => player.setEpWeights(new Stats().withStat(Stat.StatAgility, 9)));
			expect(rowFor('Agility').querySelector('.type-ep .results-avg')!.className).toBe('results-avg negative');
		});

		it('greys the columns whose EP ratio is zero', async () => {
			player.computeStatWeights.mockResolvedValue(weightsResult([[STRENGTH, 2]]));
			renderDialog();
			await act(async () => {
				fireEvent.click(calculate());
			});

			const cells = [...rowFor('Strength').querySelectorAll('td.stdev-cell')];
			expect(cells[0].classList.contains('unused-ep')).toBe(false);
			expect(cells[2].classList.contains('unused-ep')).toBe(true);
		});

		it('shows N/A for a stat excluded from the calculation', async () => {
			player.computeStatWeights.mockResolvedValue(
				weightsResult([
					[STRENGTH, 2],
					[AGILITY, 1],
				]),
			);
			renderDialog();
			settings.setStatExcluded(AGILITY, true);

			await act(async () => {
				fireEvent.click(calculate());
			});
			expect(player.computeStatWeights.mock.calls[0][0]).toEqual([Stat.StatStrength, Stat.StatCritRating]);
			expect(rowFor('Agility').querySelector('.type-ep .notapplicable')).not.toBeNull();
		});

		it('aborts through the progress dialog and leaves the EP dialog open', async () => {
			player.computeStatWeights.mockImplementation(() => new Promise(() => {}));
			renderDialog();
			await act(async () => {
				fireEvent.click(calculate());
			});
			abortType.mockClear();

			await act(async () => {
				fireEvent.click(rootElem.querySelector('button.progress-tracker-modal-cancel-btn')!);
			});

			expect(abortType).toHaveBeenCalledTimes(1);
			expect(opener.isOpen()).toBe(true);
			expect(popup().hasAttribute('hidden')).toBe(false);
		});

		it('reports an aborted run and leaves the previous results in place', async () => {
			player.computeStatWeights.mockResolvedValue({ ...emptyStatWeightsResult(), error: { type: ErrorOutcomeType.ErrorOutcomeAborted, message: '' } });
			renderDialog();
			await act(async () => {
				fireEvent.click(calculate());
			});

			expect(toasts).toEqual([{ variant: 'info', body: 'Statweight sim cancelled.' }]);
			expect(rowFor('Strength').querySelector('.type-ep .notapplicable')).not.toBeNull();
		});

		// DEFECT FIXED. `isRunning` was set before the pre-run abort and the catch returned without
		// clearing it, so one rejection left the Calculate button inert for the life of the page —
		// and it was never disabled, so it still looked live.
		it('stays usable after the pre-run abort rejects', async () => {
			abortType.mockRejectedValueOnce(new Error('worker gone'));
			player.computeStatWeights.mockResolvedValue(weightsResult([[STRENGTH, 2]]));
			renderDialog();

			await act(async () => {
				fireEvent.click(calculate());
			});
			expect(player.computeStatWeights).not.toHaveBeenCalled();
			expect(calculate().disabled).toBe(false);

			await act(async () => {
				fireEvent.click(calculate());
			});
			expect(player.computeStatWeights).toHaveBeenCalledTimes(1);
		});

		it('reports a thrown run and stays usable', async () => {
			player.computeStatWeights.mockRejectedValueOnce(new Error('sim exploded'));
			renderDialog();

			await act(async () => {
				fireEvent.click(calculate());
			});
			expect(toasts).toEqual([{ variant: 'error', body: 'sim exploded' }]);
			expect(calculate().disabled).toBe(false);
			expect(rootElem.querySelector('.progress-tracker-dialog')).toBeNull();
		});
	});

	it('opens from the opener and aborts on close', async () => {
		renderDialog();
		expect(popup().hasAttribute('hidden')).toBe(false);
		abortType.mockClear();

		await act(async () => {
			fireEvent.click(popup().querySelector('button.sim-dialog-close')!);
		});
		expect(opener.isOpen()).toBe(false);
		expect(abortType).toHaveBeenCalledTimes(1);
	});

	// DEFECT FIXED. The panel discarded the unsubscribe its table-level `subscribePlayerField`
	// returned, so the subscription outlived the panel.
	it('drops every subscription when it unmounts', () => {
		const { unmount } = renderDialog();
		expect(source.count()).toBeGreaterThan(0);
		unmount();
		expect(source.count()).toBe(0);
	});
});
