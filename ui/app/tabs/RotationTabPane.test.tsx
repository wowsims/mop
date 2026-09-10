import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The pane root's class list is exactly what both parity gates normalise away (`dropRootClasses`),
// so this is the only place the rotation-type class is checked.
vi.mock('./RotationTabBody', () => ({ RotationTabBody: () => <div className="rotation-tab-body-stub" /> }));

let rotationType = APLRotationType.TypeAuto;
const listeners = new Set<() => void>();
const player = { getRotationType: () => rotationType };
vi.mock('@sim/context/SimHostContext', () => ({ usePlayer: () => player }));
vi.mock('@sim/state/subscriptions', () => ({
	subscribePlayerField: () => (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
}));

const { RotationTabPane } = await import('./RotationTabPane');

const setRotationType = (type: APLRotationType) =>
	act(() => {
		rotationType = type;
		listeners.forEach(listener => listener());
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
