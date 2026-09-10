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
vi.mock('@features/settings', () => ({ CooldownsPicker: () => <div className="cooldowns-picker-stub" /> }));
vi.mock('../PresetConfigurationPicker', () => ({ PresetConfigurationPicker: () => <div className="preset-configuration-picker-stub" /> }));

class FakeIntersectionObserver {
	constructor(readonly callback: IntersectionObserverCallback) {}
	observe = vi.fn();
	disconnect = vi.fn();
	unobserve = vi.fn();
}

const host = {
	headerElem: document.createElement('div'),
	player: { hasSimpleRotationGenerator: () => false },
	individualConfig: {},
} as never;
vi.mock('@sim/context/SimHostContext', () => ({ useSimHost: () => host }));

const { RotationTabBody } = await import('./RotationTabBody');

const paneClasses = (container: HTMLElement) => [...container.querySelectorAll('.rotation-tab-apl .tab-pane')].map(pane => [pane.id, pane.className] as const);

beforeEach(() => vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver));
afterEach(() => vi.unstubAllGlobals());

describe('RotationTabBody', () => {
	it('opens the priority pane and leaves the other two faded out', () => {
		const { container } = render(<RotationTabBody />);
		expect(paneClasses(container)).toEqual([
			['apl-priority-list', 'tab-pane fade active show'],
			['apl-action-groups', 'tab-pane fade'],
			['apl-variables', 'tab-pane fade'],
		]);
		expect(container.querySelectorAll('.rotation-tab-apl [role=tabpanel]')).toHaveLength(3);
	});

	it('moves active on the click and show a frame later', async () => {
		const { container } = render(<RotationTabBody />);
		fireEvent.click(container.querySelector('[aria-controls="apl-variables"]')!);
		expect(container.querySelector('#apl-variables')!.className).toBe('tab-pane fade active');
		expect(container.querySelector('#apl-priority-list')!.className).toBe('tab-pane fade');
		await waitFor(() => expect(container.querySelector('#apl-variables')!.className).toBe('tab-pane fade active show'));
	});

	it('drives the strip and the panes off one selection', () => {
		const { container } = render(<RotationTabBody />);
		fireEvent.click(container.querySelector('[aria-controls="apl-action-groups"]')!);
		const selected = [...container.querySelectorAll('[role=tab]')].filter(tab => tab.getAttribute('aria-selected') === 'true');
		expect(selected.map(tab => tab.getAttribute('aria-controls'))).toEqual(['apl-action-groups']);
		expect(container.querySelector('#apl-action-groups')!.classList.contains('active')).toBe(true);
	});

	it('renders the navbar ahead of both columns, which is what the layout depends on', () => {
		const { container } = render(<RotationTabBody />);
		const pane = container.querySelector('.rotation-tab-apl')!;
		expect([...pane.children].map(child => child.className)).toEqual([
			'apl-rotation-navbar sticky-toolbar-root',
			'rotation-tab-col tab-panel-left tab-content',
			'rotation-tab-col tab-panel-right',
		]);
	});
});
