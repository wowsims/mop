import { WarningsRegistry } from '@features/results/model/warnings';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const { SimWarnings } = await import('./SimWarnings');

const registryWith = (...contents: string[]) => {
	const registry = new WarningsRegistry();
	contents.forEach(content => registry.add({ updateOn: () => () => {}, getContent: () => content }));
	return registry;
};

const zone = () => document.querySelector('.warning-zone .sim-toolbar-item') as HTMLElement;
const shown = () => !zone().classList.contains('hide');

describe('SimWarnings', () => {
	// Every warning judges gear and talents, which are empty until the sim loads, so an unready sim
	// warns about a setup nobody chose. Master shows the icon for ~800ms on every page load.
	it('says nothing while the sim is not ready, however much the registry holds', () => {
		render(<SimWarnings warnings={registryWith('an enchant needs a profession')} ready={false} />);

		expect(shown()).toBe(false);
	});

	it('shows the trigger once a ready sim has something to say', () => {
		render(<SimWarnings warnings={registryWith('an enchant needs a profession')} ready />);

		expect(shown()).toBe(true);
		expect(zone().querySelector('.warning')?.getAttribute('aria-label')).toBe('sidebar.warnings.label');
	});

	it('stays quiet when a ready sim has nothing to say', () => {
		render(<SimWarnings warnings={registryWith()} ready />);

		expect(shown()).toBe(false);
	});

	it('picks up a warning the registry gains while ready, and drops it again', () => {
		const registry = registryWith();
		const remove = { current: () => {} };
		render(<SimWarnings warnings={registry} ready />);
		expect(shown()).toBe(false);

		act(() => {
			remove.current = registry.add({ updateOn: () => () => {}, getContent: () => 'too many JC gems' });
		});
		expect(shown()).toBe(true);

		act(() => remove.current());
		expect(shown()).toBe(false);
	});

	it('subscribes only once ready, so a warning raised while loading does not show', () => {
		const registry = registryWith();
		const { rerender } = render(<SimWarnings warnings={registry} ready={false} />);

		act(() => void registry.add({ updateOn: () => () => {}, getContent: () => 'unspent talent points' }));
		expect(shown()).toBe(false);

		rerender(<SimWarnings warnings={registry} ready />);
		expect(shown()).toBe(true);
	});
});
