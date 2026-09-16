import { ActionId } from '@sim/proto/action_id';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { IconPicker } from './IconPicker';
import type { IconPickerConfig } from './types';

// A filled ActionId as fill() returns one, so useActionId renders synchronously and no test
// touches the network — see ui/ui-kit/hooks/useActionId.test.tsx for the same pattern.
const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const buffId = filled(ActionId.fromSpellId(1), 'Buff', 'buff.jpg');

// Stands in for a domain facade: a numeric value plus the (onChange) => unsubscribe contract
// every storeSubscribe helper in state/subscriptions.ts returns.
class Settings {
	private listeners = new Set<() => void>();
	visible = true;
	constructor(public level: number | boolean = 0) {}
	set(next: number | boolean) {
		this.level = next;
		this.notify();
	}
	setVisible(next: boolean) {
		this.visible = next;
		this.notify();
	}
	notify() {
		this.listeners.forEach(listener => listener());
	}
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
}

const configFor = (extra: Partial<IconPickerConfig<Settings, number>> = {}): IconPickerConfig<Settings, number> => ({
	id: 'buff-icon',
	actionId: buffId,
	states: 2,
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => Number(settings.level),
	setValue: (settings, value) => settings.set(value),
	...extra,
});

// By role would miss it before `useActionId` resolves: an <a> without an href has no `link` role.
const allAnchors = () => Array.from(document.querySelectorAll('a'));
const mainAnchor = () => allAnchors()[0];

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return this;
	});
});

describe('IconPicker', () => {
	// use-counter is added for states > 2, but the counter TEXT only renders at states > 3 (or
	// states === 0). At states === 3 the class is present and the text is empty — reproduce that
	// asymmetry exactly.
	it('shows the use-counter class but no text at states 3', () => {
		const settings = new Settings(2);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(mainAnchor().hasAttribute('data-use-counter')).toBe(true);
		expect(screen.queryByText('2')).toBeNull();
	});

	it('shows the counter text at states 4', () => {
		const settings = new Settings(3);
		render(<IconPicker modObject={settings} config={configFor({ states: 4 })} />);
		expect(screen.getByText('3')).toBeTruthy();
	});

	it('left-clicks to the next state and rolls over to 0 at the top', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);

		fireEvent.click(mainAnchor());
		expect(settings.level).toBe(1);

		fireEvent.click(mainAnchor());
		expect(settings.level).toBe(2);

		fireEvent.click(mainAnchor());
		expect(settings.level).toBe(0);
	});

	it('right-clicks via mousedown(button 2) to the previous state and rolls over to the top', () => {
		const settings = new Settings(1);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);

		fireEvent.mouseDown(mainAnchor(), { button: 2 });
		expect(settings.level).toBe(0);

		fireEvent.mouseDown(mainAnchor(), { button: 2 });
		expect(settings.level).toBe(2);
	});

	it('does not change the value on a plain mousedown (button 0)', () => {
		const settings = new Settings(1);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);

		fireEvent.mouseDown(mainAnchor(), { button: 0 });
		expect(settings.level).toBe(1);
	});

	it('writes a boolean, not a number, back to the source at states 2', () => {
		const settings = new Settings(false);
		const setValue = vi.fn((s: Settings, v: number | boolean) => s.set(v));
		render(<IconPicker modObject={settings} config={configFor({ setValue })} />);
		fireEvent.click(mainAnchor());
		expect(setValue).toHaveBeenCalledWith(settings, true);
	});

	it('suppresses the browser context menu', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor()} />);
		const event = fireEvent.contextMenu(mainAnchor());
		// fireEvent returns false when preventDefault() was called.
		expect(event).toBe(false);
	});

	it('marks the main anchor and label active once the value is above zero', () => {
		const settings = new Settings(1);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(mainAnchor().hasAttribute('data-active')).toBe(true);
		expect(screen.getByTestId('icon-picker-label').hasAttribute('data-active')).toBe(true);
	});

	it('does not mark the main anchor active at zero', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(mainAnchor().hasAttribute('data-active')).toBe(false);
	});

	it('stores the value and zeroes the source when showWhen goes false, and restores it when true again', () => {
		const settings = new Settings(2);
		render(<IconPicker modObject={settings} config={configFor({ states: 3, showWhen: s => s.visible })} />);
		expect(settings.level).toBe(2);

		act(() => settings.setVisible(false));
		expect(settings.level).toBe(0);

		act(() => settings.setVisible(true));
		expect(settings.level).toBe(2);
	});

	// It stores from its source subscription, so it acts on any notification while hidden — not on
	// a transition — and never during construction.
	it('zeroes a picker that mounts hidden at the first notification, not at mount', () => {
		const settings = new Settings(2);
		settings.visible = false;
		render(<IconPicker modObject={settings} config={configFor({ states: 3, showWhen: s => s.visible })} />);
		expect(settings.level).toBe(2);

		act(() => settings.notify());
		expect(settings.level).toBe(0);

		act(() => settings.setVisible(true));
		expect(settings.level).toBe(2);
	});

	// StrictMode replays the effect over the same refs, so a one-shot "skip the first run" flag lets
	// the second run through and writes at mount. Only vitest and the dev server double-invoke.
	it('still writes nothing at mount under StrictMode', () => {
		const settings = new Settings(2);
		settings.visible = false;
		render(
			<StrictMode>
				<IconPicker modObject={settings} config={configFor({ states: 3, showWhen: s => s.visible })} />
			</StrictMode>,
		);
		expect(settings.level).toBe(2);

		act(() => settings.notify());
		expect(settings.level).toBe(0);
	});

	it('restores the normalised value, so a numeric source is written back as a boolean at states 2', () => {
		const settings = new Settings(1);
		const setValue = vi.fn((s: Settings, v: number | boolean) => s.set(v));
		render(<IconPicker modObject={settings} config={configFor({ setValue, showWhen: s => s.visible })} />);

		act(() => settings.setVisible(false));
		act(() => settings.setVisible(true));

		expect(setValue).toHaveBeenLastCalledWith(settings, true);
	});

	it('carries the wowhead opt-outs and opens in a new tab', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor()} />);
		const main = mainAnchor();
		expect(main.target).toBe('_blank');
		expect(main.dataset.whtticon).toBe('false');
		expect(main.dataset.disableWowheadTouchTooltip).toBe('true');
	});

	it('renders no counter label at states 2 and renders one above', () => {
		const settings = new Settings(0);
		const { rerender } = render(<IconPicker modObject={settings} config={configFor()} />);
		const label = () => screen.queryByTestId('icon-picker-label');
		expect(label()).toBeNull();

		rerender(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(label()).toBeTruthy();
	});

	it('writes the disabled attribute on the anchor as well as the class on the root', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(mainAnchor().hasAttribute('disabled')).toBe(true);
		expect(screen.getByTestId('icon-picker-root').hasAttribute('data-disabled')).toBe(true);
	});

	it("renders the level container as the anchor's next sibling, so no anchor sits inside another", () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ states: 4 })} />);
		const anchor = screen.getByTestId('icon-picker-button');
		const container = screen.getByTestId('icon-input-level-container');

		expect(anchor.nextElementSibling).toBe(container);
		expect(anchor.contains(container)).toBe(false);
		expect(anchor.children).toHaveLength(0);
		expect(document.querySelectorAll('a a')).toHaveLength(0);
	});

	it('keeps the counter inside the container', () => {
		const settings = new Settings(3);
		render(<IconPicker modObject={settings} config={configFor({ states: 4 })} />);
		const container = screen.getByTestId('icon-input-level-container');

		expect(container.children).toHaveLength(1);
		expect(within(container).getByTestId('icon-picker-label')).toBeTruthy();
	});
});

describe('IconPickerConfig', () => {
	type WithoutBinding = Omit<IconPickerConfig<Settings, number>, 'storeSubscribe' | 'storeField'>;
	type FieldOnly = WithoutBinding & { storeField: 'bonusStats' };

	it('will not accept a config that names neither a store subscription nor a store field', () => {
		expectTypeOf<WithoutBinding>().not.toExtend<IconPickerConfig<Settings, number>>();
		expectTypeOf<FieldOnly>().toExtend<IconPickerConfig<Settings, number>>();
	});
});
