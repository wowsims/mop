import { APLRotation, APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { createSimStore, patchKeyed, PLAYER_FIELDS, type PlayerSlice, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The pane root's class list is exactly what both parity gates normalise away (`dropRootClasses`),
// so this is the only place the rotation-type class is checked.
vi.mock('./RotationTabBody', () => ({ RotationTabBody: () => <div className="rotation-tab-body-stub" /> }));

const KEY = 1;
const store = createSimStore();
seedKeyed(store, 'players', KEY, { v: zeroVersions(PLAYER_FIELDS) } as unknown as PlayerSlice);

let rotationType = APLRotationType.TypeAuto;
const player = { sim: { store }, storeKey: KEY, aplRotation: APLRotation.create(), getRotationType: () => rotationType };
vi.mock('@sim/context/SimHostContext', () => ({ usePlayer: () => player }));

const { RotationTabPane } = await import('./RotationTabPane');

// `useAplRotation` selects the slice's rotation counter, so the change signal is the bump the APL
// editor's writes make — there is no subscription seam left to stub.
const setRotationType = (type: APLRotationType) =>
	act(() => {
		rotationType = type;
		patchKeyed(store, 'players', KEY, {}, ['rotation']);
	});

describe('RotationTabPane', () => {
	it('names the rotation type on the pane root, which is what shows one of the three sub-tabs', async () => {
		rotationType = APLRotationType.TypeAuto;
		const { container } = render(<RotationTabPane />);
		const pane = container.querySelector('#rotation-tab')!;
		expect([...pane.classList]).toEqual(['sim-tab', 'rotation-tab', 'rotation-type-auto']);

		await setRotationType(APLRotationType.TypeAPL);
		expect([...pane.classList]).toEqual(['sim-tab', 'rotation-tab', 'rotation-type-apl']);

		await setRotationType(APLRotationType.TypeSimple);
		expect([...pane.classList]).toEqual(['sim-tab', 'rotation-tab', 'rotation-type-simple']);
	});

	it('renders the body inside the content container the stylesheets extend', () => {
		const { container } = render(<RotationTabPane />);
		expect(container.querySelector('#rotation-tab > .tab-pane-content-container > .rotation-tab-body-stub')).not.toBeNull();
	});
});
