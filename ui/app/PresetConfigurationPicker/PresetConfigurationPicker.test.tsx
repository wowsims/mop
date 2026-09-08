import { SimHostProvider } from '@sim/context/SimHostContext';
import type { IndividualSimHost } from '@sim/sim_host';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const applyBuild = vi.fn();
const activeNames = new Set<string>();

vi.mock('@features/settings/model/apply_build', () => ({ applyBuild: (...args: unknown[]) => applyBuild(...args) }));
vi.mock('../preset_build_state', () => ({
	buildCategories: () => ['Gear'],
	isBuildActive: (build: { name: string }) => activeNames.has(build.name),
}));
vi.mock('@sim/state/subscriptions', () => ({ subscribeSimChange: () => () => () => {} }));
vi.mock('@sim/hooks/useSimReady', () => ({ useSimReady: () => ready }));

let ready = true;
const { PresetConfigurationPicker } = await import('./PresetConfigurationPicker');

const setup = (builds: Array<Record<string, unknown>>, categories = ['gear']) => {
	const host = { sim: {}, individualConfig: { presets: { builds } } } as unknown as IndividualSimHost<any>;
	return render(
		<SimHostProvider host={host}>
			<PresetConfigurationPicker categories={categories as never} />
		</SimHostProvider>,
	);
};

const chips = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.saved-data-set-chip')];

beforeEach(() => {
	applyBuild.mockClear();
	activeNames.clear();
	ready = true;
});

describe('PresetConfigurationPicker', () => {
	it('renders one chip per build, with the name as the clickable span', () => {
		const { container } = setup([
			{ name: 'P1', gear: {} },
			{ name: 'P2', gear: {} },
		]);

		expect(chips(container)).toHaveLength(2);
		expect(chips(container).map(chip => chip.querySelector('.saved-data-set-name')?.textContent)).toEqual(['P1', 'P2']);
		expect(chips(container)[0].querySelector('.saved-data-set-name')?.getAttribute('role')).toBe('button');
	});

	// The picker is mounted in four places with different category lists, and each shows only the
	// builds touching its own categories.
	it('keeps only the builds that carry one of its categories', () => {
		const { container } = setup(
			[
				{ name: 'P1', gear: {} },
				{ name: 'P2', talents: {} },
			],
			['gear'],
		);

		expect(chips(container).map(chip => chip.textContent)).toEqual(['P1']);
	});

	it('marks the active build, and only that one', () => {
		activeNames.add('P2');
		const { container } = setup([
			{ name: 'P1', gear: {} },
			{ name: 'P2', gear: {} },
		]);

		expect(chips(container).map(chip => chip.classList.contains('active'))).toEqual([false, true]);
	});

	it('applies the build the name was clicked on', () => {
		const { container } = setup([
			{ name: 'P1', gear: {} },
			{ name: 'P2', gear: {} },
		]);

		fireEvent.click(chips(container)[1].querySelector('.saved-data-set-name')!);

		expect(applyBuild).toHaveBeenCalledTimes(1);
		expect((applyBuild.mock.calls[0][0] as { name: string }).name).toBe('P2');
	});

	// Vanilla hides the root rather than rendering an empty block, and five specs have no builds at
	// all, so the hidden root is what those panes contain.
	it('renders a hidden root and no content block when there are no builds', () => {
		const { container } = setup([]);

		expect(container.querySelector('.preset-configuration-picker-root')?.classList.contains('hide')).toBe(true);
		expect(container.querySelector('.content-block')).toBeNull();
	});

	// The chips are built inside `waitForInit` in vanilla; before that the block exists but is empty.
	it('renders the block but no chips before the sim is ready', () => {
		ready = false;
		const { container } = setup([{ name: 'P1', gear: {} }]);

		expect(container.querySelector('.content-block')).not.toBeNull();
		expect(chips(container)).toHaveLength(0);
	});
});
