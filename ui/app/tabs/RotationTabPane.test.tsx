import { APLRotation, APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { createSimStore, patchKeyed, PLAYER_FIELDS, type PlayerSlice, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./RotationTabBody', () => ({ RotationTabBody: () => <div data-testid="rotation-tab-body-stub" /> }));

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
	it('names the rotation type on the pane root', async () => {
		rotationType = APLRotationType.TypeAuto;
		const { container } = render(<RotationTabPane />);
		const pane = container.querySelector('#rotation-tab')!;
		expect(pane.getAttribute('data-rotation-type')).toBe('auto');

		await setRotationType(APLRotationType.TypeAPL);
		expect(pane.getAttribute('data-rotation-type')).toBe('apl');

		await setRotationType(APLRotationType.TypeSimple);
		expect(pane.getAttribute('data-rotation-type')).toBe('simple');
	});

	it('renders the body inside the content container the stylesheets extend', () => {
		const { container } = render(<RotationTabPane />);
		expect(container.querySelector('#rotation-tab > [data-testid="tab-pane-content-container"] > [data-testid="rotation-tab-body-stub"]')).not.toBeNull();
	});
});
