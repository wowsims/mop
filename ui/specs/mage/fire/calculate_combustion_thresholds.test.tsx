import type { Spec } from '@generated/proto/common';
import type { IndividualSimHost } from '@sim/sim_host';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.fn();
vi.mock('@ui-kit/toast', () => ({
	default: class {
		constructor(...args: unknown[]) {
			toast(...args);
		}
	},
}));

const { CombustionThresholds, registerCombustionThresholds } = await import('./calculate_combustion_thresholds');
const { SidebarRegistry } = await import('@ui-kit/sidebar_registry');

const ESTIMATE = 12345;
const LOGS = `-SIMSTART-\n[30.00] Combustion Dot Estimate: ${ESTIMATE}`;

const rootElem = document.createElement('div');
const setSimpleRotation = vi.fn();
let runGearSim: ReturnType<typeof vi.fn>;

const makeHost = () =>
	({
		rootElem,
		runGearSim,
		player: {
			getGear: () => ({}),
			getSimpleRotation: () => ({ combustAlwaysSend: 1, combustBloodlust: 2, combustPostAlter: 3, combustNoAlter: 4, combustEndOfCombat: 5 }),
			setSimpleRotation,
		},
		sim: {
			shouldUseWasmConcurrency: async () => false,
			signalManager: { abortType: vi.fn() },
		},
	}) as unknown as IndividualSimHost<Spec.SpecFireMage>;

const renderFeature = () => render(<CombustionThresholds host={makeHost()} />);
const actionButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('button.mage-calculate-combustion-threshold-group')!;

beforeEach(() => {
	rootElem.replaceChildren();
	document.body.appendChild(rootElem);
	toast.mockClear();
	setSimpleRotation.mockClear();
	runGearSim = vi.fn(async () => [{}, { logs: LOGS }]);
});

describe('CombustionThresholds', () => {
	it('renders one sidebar action button carrying the spec hook and the shared action classes', () => {
		const { container } = renderFeature();
		const button = actionButton(container);

		expect([...button.classList].sort()).toEqual(['btn', 'btn-primary', 'mage-calculate-combustion-threshold-group', 'sim-sidebar-action-button', 'w-100']);
		expect(button.disabled).toBe(false);
		expect(container.querySelector('.sim-sidebar-action-button-loading-icon')).not.toBeNull();
	});

	it('registers itself as one sidebar entry rather than reaching into the DOM', () => {
		const registry = new SidebarRegistry();
		registerCombustionThresholds({ sidebar: registry } as unknown as IndividualSimHost<Spec.SpecFireMage>);

		expect(registry.getEntries()).toHaveLength(1);
		expect(registry.getEntries()[0].id).toBe('mage-calculate-combustion-thresholds');
	});

	it('disables the button and shows the progress tracker while the run is in flight, then re-enables it', async () => {
		const releases: Array<(value: unknown) => void> = [];
		runGearSim = vi.fn(() => new Promise(resolve => releases.push(resolve)));

		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});

		expect(actionButton(container).disabled).toBe(true);
		expect(rootElem.querySelector('.combustion-thresholds-progress-tracker')).not.toBeNull();

		await act(async () => {
			releases.forEach(release => release([{}, { logs: LOGS }]));
		});

		await waitFor(() => expect(actionButton(container).disabled).toBe(false));
		expect(rootElem.querySelector('.combustion-thresholds-progress-tracker')).toBeNull();
	});

	it('opens the results dialog with the thresholds it computed, and applies them on update', async () => {
		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});

		const dialog = await waitFor(() => {
			const found = rootElem.querySelector('.combustion-thresholds-modal');
			expect(found).not.toBeNull();
			return found!;
		});

		// combustPostAlter is the one threshold taken from .max.
		const rows = [...dialog.querySelectorAll('tbody tr')];
		expect(rows).toHaveLength(5);
		expect(rows[2].querySelector('.positive')?.textContent).toBe(String(ESTIMATE));
		expect(rows[2].querySelector('.negative')?.textContent).toBe('3');

		const update = [...dialog.querySelectorAll('button')].find(button => button.textContent?.includes('update'))!;
		await act(async () => {
			fireEvent.click(update);
		});

		expect(setSimpleRotation).toHaveBeenCalledWith(expect.objectContaining({ combustPostAlter: ESTIMATE }));
		expect(toast).toHaveBeenCalled();
		await waitFor(() => expect(rootElem.querySelector('.combustion-thresholds-modal')).toBeNull());
	});

	it('unwinds cleanly when the run is cancelled, opening no results dialog', async () => {
		runGearSim = vi.fn(() => new Promise(() => {}));

		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});
		expect(actionButton(container).disabled).toBe(true);

		await act(async () => {
			fireEvent.click(rootElem.querySelector<HTMLButtonElement>('.progress-tracker-modal-cancel-btn')!);
		});

		await waitFor(() => expect(actionButton(container).disabled).toBe(false));
		expect(rootElem.querySelector('.combustion-thresholds-progress-tracker')).toBeNull();
		expect(rootElem.querySelector('.combustion-thresholds-modal')).toBeNull();
	});

	it('runs one gear sim per batch', async () => {
		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});

		await waitFor(() => expect(rootElem.querySelector('.combustion-thresholds-modal')).not.toBeNull());
		expect(runGearSim).toHaveBeenCalledTimes(10);
	});
});
