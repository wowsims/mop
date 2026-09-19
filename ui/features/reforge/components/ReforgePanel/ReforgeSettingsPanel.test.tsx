import { SimHostProvider } from '@sim/context/SimHostContext';
import { createSimStore } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions());
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('../../../../tracking/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@features/stat-weights/components/SavedEpWeights', () => ({ SavedEpWeights: () => null }));
vi.mock('@features/stat-weights/hooks/useEpWeightsDialog', () => ({ useOpenEpWeights: () => vi.fn() }));
vi.mock('./ReforgeStatCaps', () => ({ ReforgeStatCaps: () => null }));
vi.mock('./ReforgeFrozenSlots', () => ({ ReforgeFrozenSlots: () => null }));
vi.mock('./ReforgeBreakpointLimits', () => ({ ReforgeBreakpointLimits: () => null }));

const { ReforgeSettingsPanel } = await import('./ReforgeSettingsPanel');

const mount = (phase: number, gemsLocked: boolean, idPrefix?: string) => {
	const settings = {
		includeGems: false,
		includeEOTBPGemSocket: false,
		useCustomEPValues: false,
		useSoftCapBreakpoints: false,
		freezeItemSlots: false,
		relativeStatCapStat: -1,
		relativeStatCapPrecision: 0.0005,
		relativeStatCap: null,
		setIncludeGems: vi.fn(),
		setIncludeEOTBPGemSocket: vi.fn(),
	};
	const player = {
		storeKey: 1,
		sim: { store: createSimStore(), getPhase: () => phase },
		getClass: () => 0,
		getGear: () => ({ hasTrinketFromOptions: () => false }),
		hasEotBPItemEquipped: () => true,
	};
	const host = fakeHost({ player, sim: player.sim });
	const { container } = render(
		<SimHostProvider host={host}>
			<ReforgeSettingsPanel
				model={{ settings, softCapsConfig: [], enableBreakpointLimits: false } as never}
				idPrefix={idPrefix}
				gemsLocked={gemsLocked}
			/>
		</SimHostProvider>,
	);
	return (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;
};

describe('ReforgeSettingsPanel gem rows', () => {
	it('reads the gem rows as on and read-only where the batch sim forces them', () => {
		const input = mount(5, true, 'bulk-reforge-optimizer');

		expect(input('bulk-reforge-optimizer-include-gems').checked).toBe(true);
		expect(input('bulk-reforge-optimizer-include-gems').disabled).toBe(true);
		expect(input('bulk-reforge-optimizer-include-eotbp-socket').checked).toBe(true);
		expect(input('bulk-reforge-optimizer-include-eotbp-socket').disabled).toBe(true);
	});

	it('follows the phase for the locked socket row, which the batch derives from it', () => {
		const input = mount(1, true, 'bulk-reforge-optimizer');

		expect(input('bulk-reforge-optimizer-include-eotbp-socket').checked).toBe(false);
	});

	it('leaves the gem row writable and off under the stored settings', () => {
		const input = mount(5, false);

		expect(input('reforge-optimizer-include-gems').checked).toBe(false);
		expect(input('reforge-optimizer-include-gems').disabled).toBe(false);
	});
});
