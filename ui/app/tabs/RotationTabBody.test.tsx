import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

// Every list is somebody else's component and is tested where it lives. What is under test here is
// the assembly: which pane the strip opens, and the two-phase class the fade needs.
vi.mock('@features/apl/components/GroupList', () => ({ GroupList: () => <div className="group-list-stub" /> }));
vi.mock('@features/apl/components/PrePullList', () => ({ PrePullList: () => <div className="pre-pull-list-stub" /> }));
vi.mock('@features/apl/components/PriorityList', () => ({ PriorityList: () => <div className="priority-list-stub" /> }));
vi.mock('@features/apl/components/RotationTypePicker', () => ({ RotationTypePicker: () => <div className="rotation-type-picker-stub" /> }));
vi.mock('@features/apl/components/SavedRotation', () => ({ SavedRotation: () => <div className="saved-rotation-stub" /> }));
vi.mock('@features/apl/components/SimpleRotationInputs', () => ({ SimpleRotationInputs: () => <div className="simple-rotation-inputs-stub" /> }));
vi.mock('@features/apl/components/VariablesList', () => ({ VariablesList: () => <div className="variables-list-stub" /> }));
vi.mock('@features/settings', () => ({
	CooldownsPicker: () => <div className="cooldowns-picker-stub" />,
	useAvailableCooldowns: () => available,
}));
vi.mock('../PresetConfigurationPicker', () => ({ PresetConfigurationPicker: () => <div className="preset-configuration-picker-stub" /> }));

class FakeIntersectionObserver {
	constructor(readonly callback: IntersectionObserverCallback) {}
	observe = vi.fn();
	disconnect = vi.fn();
	unobserve = vi.fn();
}

let simple = false;
let available: Array<unknown> = [];
const host = { player: { hasSimpleRotationGenerator: () => simple } } as never;
vi.mock('@sim/context/SimHostContext', () => ({ useSimHost: () => host, useSpecConfig: () => ({ rotationInputs: {} }) }));

const { RotationTabBody } = await import('./RotationTabBody');

const paneStates = (container: HTMLElement) =>
	[...container.querySelectorAll('.rotation-tab-apl .tab-pane')].map(pane => [pane.id, (pane as HTMLElement).hidden] as const);

beforeEach(() => vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver));
afterEach(() => {
	vi.unstubAllGlobals();
	simple = false;
	available = [];
});

describe('RotationTabBody', () => {
	it('opens the priority pane and leaves the other two faded out', () => {
		const { container } = render(<RotationTabBody rotationType={APLRotationType.TypeAPL} />);
		expect(paneStates(container)).toEqual([
			['apl-priority-list', false],
			['apl-action-groups', true],
			['apl-variables', true],
		]);
		expect(container.querySelectorAll('.rotation-tab-apl [role=tabpanel]')).toHaveLength(3);
	});

	it('moves active on the click and show a frame later', async () => {
		const { container } = render(<RotationTabBody rotationType={APLRotationType.TypeAPL} />);
		fireEvent.click(container.querySelector('[aria-controls="apl-variables"]')!);
		expect(container.querySelector<HTMLElement>('#apl-variables')!.hidden).toBe(false);
		expect(container.querySelector('#apl-variables')!.hasAttribute('data-starting-style')).toBe(true);
		expect(container.querySelector('#apl-priority-list')!.hasAttribute('data-ending-style')).toBe(true);
		await waitFor(() => expect(container.querySelector('#apl-variables')!.hasAttribute('data-starting-style')).toBe(false));
	});

	it('drives the strip and the panes off one selection', () => {
		const { container } = render(<RotationTabBody rotationType={APLRotationType.TypeAPL} />);
		fireEvent.click(container.querySelector('[aria-controls="apl-action-groups"]')!);
		const selected = [...container.querySelectorAll('[role=tab]')].filter(tab => tab.getAttribute('aria-selected') === 'true');
		expect(selected.map(tab => tab.getAttribute('aria-controls'))).toEqual(['apl-action-groups']);
		expect(container.querySelector<HTMLElement>('#apl-action-groups')!.hidden).toBe(false);
	});

	it('renders no cooldown settings while the spec offers no major cooldowns', () => {
		simple = true;
		const { container, rerender } = render(<RotationTabBody rotationType={APLRotationType.TypeAPL} />);
		expect(container.querySelector('.cooldown-settings')).toBeNull();

		available = [{}];
		rerender(<RotationTabBody rotationType={APLRotationType.TypeAPL} />);
		expect(container.querySelector('.cooldown-settings')).not.toBeNull();
	});

	it('renders the navbar ahead of both columns, which is what the layout depends on', () => {
		const { container } = render(<RotationTabBody rotationType={APLRotationType.TypeAPL} />);
		const pane = container.querySelector('.rotation-tab-apl')!;
		const [navbar, left, right] = [...pane.children];
		expect(navbar.getAttribute('data-testid')).toBe('apl-rotation-navbar');
		expect(left.classList.contains('tab-panel-left')).toBe(true);
		expect(right.classList.contains('tab-panel-right')).toBe(true);
	});
});
