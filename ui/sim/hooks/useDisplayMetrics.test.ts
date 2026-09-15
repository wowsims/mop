import { Spec } from '@generated/proto/common';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Raid } from '../raid/raid';
import type { Sim } from '../sim';
import { createSimStore, patchSlice, type SimStore } from '../state/sim_store';
import { useDisplayMetrics } from './useDisplayMetrics';

const fakeSim = (store: SimStore, specID: Spec) => {
	const ui = () => store.getState().ui;
	const raid = { getPlayer: () => ({ playerSpec: { specID } }) } as unknown as Raid;
	return {
		store,
		raid,
		getShowDamageMetrics: () => ui().showDamageMetrics,
		getShowThreatMetrics: () => ui().showThreatMetrics,
		getShowHealingMetrics: () =>
			ui().showHealingMetrics ||
			(ui().showThreatMetrics &&
				[Spec.SpecBloodDeathKnight, Spec.SpecGuardianDruid, Spec.SpecBrewmasterMonk, Spec.SpecProtectionPaladin, Spec.SpecProtectionWarrior].includes(
					specID,
				)),
	} as unknown as Sim;
};

describe('useDisplayMetrics', () => {
	it('follows showThreatMetrics on a tank spec, with no write to showHealingMetrics', () => {
		const store = createSimStore();
		const sim = fakeSim(store, Spec.SpecProtectionWarrior);
		const { result } = renderHook(() => useDisplayMetrics(sim));

		expect(result.current.healing).toBe(false);

		act(() => patchSlice(store, 'ui', { showThreatMetrics: true }));

		expect(result.current.healing).toBe(true);
		expect(store.getState().ui.showHealingMetrics).toBe(false);
	});

	it('does not derive healing from showThreatMetrics on a non-tank spec', () => {
		const store = createSimStore();
		const sim = fakeSim(store, Spec.SpecArmsWarrior);
		const { result } = renderHook(() => useDisplayMetrics(sim));

		act(() => patchSlice(store, 'ui', { showThreatMetrics: true }));

		expect(result.current.healing).toBe(false);
	});
});
