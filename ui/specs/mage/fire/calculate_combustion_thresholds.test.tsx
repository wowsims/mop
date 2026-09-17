import type { Spec } from '@generated/proto/common';
import type { IndividualSimHost } from '@sim/sim_host';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { PortalContainerContext } from '@ui-kit/hooks/usePortalContainer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.fn();
vi.mock('@ui-kit/Toast', async importOriginal => ({
	...(await importOriginal<typeof import('@ui-kit/Toast')>()),
	toastManager: { add: toast, close: () => {} },
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

// `SimApp` provides this context with the same element the host exposes as `rootElem`.
const renderFeature = () =>
	render(
		<PortalContainerContext value={rootElem}>
			<CombustionThresholds host={makeHost()} />
		</PortalContainerContext>,
	);
const actionButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('[data-testid="mage-calculate-combustion-threshold-group"]')!;

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
		const button = within(container).getByRole<HTMLButtonElement>('button');

		expect(button).toBe(actionButton(container));
		expect(button.getAttribute('data-testid')).toBe('mage-calculate-combustion-threshold-group');
		expect(button.hasAttribute('data-sidebar-action')).toBe(true);
		expect(button.classList.contains('w-full')).toBe(true);
		expect(button.disabled).toBe(false);
		expect(container.querySelector('[data-sidebar-action-loading-icon]')).not.toBeNull();
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
		expect(rootElem.querySelector('[data-testid="combustion-thresholds-progress-tracker"]')).not.toBeNull();

		await act(async () => {
			releases.forEach(release => release([{}, { logs: LOGS }]));
		});

		await waitFor(() => expect(actionButton(container).disabled).toBe(false));
		expect(rootElem.querySelector('[data-testid="combustion-thresholds-progress-tracker"]')).toBeNull();
	});

	it('opens the results dialog with the thresholds it computed, and applies them on update', async () => {
		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});

		const dialog = await waitFor(() => {
			const found = rootElem.querySelector('[data-testid="combustion-thresholds-modal"]');
			expect(found).not.toBeNull();
			return found!;
		});

		// combustPostAlter is the one threshold taken from .max.
		const rows = [...dialog.querySelectorAll('tbody tr')];
		expect(rows).toHaveLength(5);
		expect(rows[2].querySelector('[data-testid="combustion-thresholds-new"]')?.textContent).toBe(String(ESTIMATE));
		expect(rows[2].querySelector('[data-testid="combustion-thresholds-current"]')?.textContent).toBe('3');

		const update = [...dialog.querySelectorAll('button')].find(button => button.textContent?.includes('update'))!;
		await act(async () => {
			fireEvent.click(update);
		});

		expect(setSimpleRotation).toHaveBeenCalledWith(expect.objectContaining({ combustPostAlter: ESTIMATE }));
		expect(toast).toHaveBeenCalled();
		await waitFor(() => expect(rootElem.querySelector('[data-testid="combustion-thresholds-modal"]')).toBeNull());
	});

	it('unwinds cleanly when the run is cancelled, opening no results dialog', async () => {
		runGearSim = vi.fn(() => new Promise(() => {}));

		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});
		expect(actionButton(container).disabled).toBe(true);

		await act(async () => {
			fireEvent.click(rootElem.querySelector<HTMLButtonElement>('[data-testid="progress-tracker-modal-cancel-btn"]')!);
		});

		await waitFor(() => expect(actionButton(container).disabled).toBe(false));
		expect(rootElem.querySelector('[data-testid="combustion-thresholds-progress-tracker"]')).toBeNull();
		expect(rootElem.querySelector('[data-testid="combustion-thresholds-modal"]')).toBeNull();
	});

	it('runs one gear sim per batch', async () => {
		const { container } = renderFeature();
		await act(async () => {
			fireEvent.click(actionButton(container));
		});

		await waitFor(() => expect(rootElem.querySelector('[data-testid="combustion-thresholds-modal"]')).not.toBeNull());
		expect(runGearSim).toHaveBeenCalledTimes(10);
	});
});
