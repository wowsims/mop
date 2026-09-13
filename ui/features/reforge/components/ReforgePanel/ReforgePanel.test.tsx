import { SimHostProvider } from '@sim/context/SimHostContext';
import { fakeHost } from '@sim/testing';
import { act, fireEvent, render } from '@testing-library/react';
import { BASE, SIZE, VARIANT } from '@ui-kit/Button/classes';
import { PortalContainerContext } from '@ui-kit/hooks/usePortalContainer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackPageView = vi.fn();
const runState = { isRunning: false, isAborting: false, abort: vi.fn() };

vi.mock('../../../../tracking/analytics', () => ({ trackEvent: vi.fn(), trackPageView: (...args: unknown[]) => trackPageView(...args) }));
vi.mock('@sim/hooks/useSimRun', () => ({ useSimRun: () => runState }));
vi.mock('./ReforgeSettingsPanel', () => ({ ReforgeSettingsPanel: () => <div data-testid="settings-body" /> }));

const { ReforgePanel } = await import('./ReforgePanel');

const model = {
	settings: {},
	softCapsConfigWithLimits: [],
	previousGear: null,
} as any;

const host = fakeHost({ rootElem: document.createElement('div'), sim: { runs: { isRunning: () => false } } });

const renderPanel = () =>
	render(
		<PortalContainerContext value={host.rootElem}>
			<SimHostProvider host={host}>
				<ReforgePanel model={model} />
			</SimHostProvider>
		</PortalContainerContext>,
	);

beforeEach(() => {
	trackPageView.mockClear();
	runState.isRunning = false;
});

describe('ReforgePanel', () => {
	// The class lists the sidebar's action group gave the two buttons; the group element itself is `ReforgeSidebarGroup`'s.
	it('renders the run button and the settings trigger with the sidebar action classes', () => {
		const { container } = renderPanel();
		const [run, settings] = [...container.querySelectorAll('button')];

		expect([...run.classList].sort()).toEqual(
			[
				...BASE.split(' '),
				...VARIANT.primary.split(' '),
				'grow',
				'py-2',
				'px-[calc(--spacing(3)+var(--settings-button-width))]',
				'mr-[calc(var(--settings-button-width)*-1)]',
				'sim-sidebar-action-button',
				'suggest-reforges-action-button',
			].sort(),
		);
		expect([...settings.classList].sort()).toEqual(
			[
				...BASE.split(' '),
				...SIZE.default.split(' '),
				...VARIANT.primary.split(' '),
				'bg-transparent',
				'border-transparent',
				'w-(--settings-button-width)',
				'sim-sidebar-action-button',
				'suggest-reforges-button-settings',
			].sort(),
		);
		expect(settings.querySelector('.fa-cog')).not.toBeNull();
		expect(container.querySelectorAll('.sim-sidebar-action-button-loading-icon')).toHaveLength(2);
	});

	it('disables the run button while a reforge run is in flight', () => {
		runState.isRunning = true;
		const { container } = renderPanel();

		expect(container.querySelector('button')?.disabled).toBe(true);
	});

	it('builds no popover body and tracks no page view until the trigger is used', () => {
		const { container } = renderPanel();

		expect(container.querySelector('[data-testid="settings-body"]')).toBeNull();
		expect(document.querySelector('[data-testid="settings-body"]')).toBeNull();
		expect(trackPageView).not.toHaveBeenCalled();
	});

	it('mounts no progress dialog until a run starts', () => {
		renderPanel();

		expect(document.querySelector('[data-testid="progress-tracker-dialog"]')).toBeNull();
	});

	it('builds the body and tracks the page view when the trigger opens the popover', async () => {
		const { container } = renderPanel();
		const settings = [...container.querySelectorAll('button')][1];

		await act(async () => void fireEvent.click(settings));

		expect(host.rootElem.querySelector('[data-testid="settings-body"]')).not.toBeNull();
		expect(trackPageView).toHaveBeenCalledWith('Reforge Settings', 'reforge-settings');
	});
});
