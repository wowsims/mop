import { ActionId } from '@domain/proto_utils/action_id';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IconPickerConfig } from '@ui-kit/pickers/icon_picker';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IconPicker } from './IconPicker';

// A filled ActionId as fill() returns one, so useActionId renders synchronously and no test
// touches the network — see ui/ui-kit/hooks/useActionId.test.tsx for the same pattern.
const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const buffId = filled(ActionId.fromSpellId(1), 'Buff', 'buff.jpg');
const improvedId = filled(ActionId.fromSpellId(2), 'Improved Buff', 'improved.jpg');
const improvedId2 = filled(ActionId.fromSpellId(3), 'Greater Buff', 'greater.jpg');

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

// By role would miss them: an <a> without an href has no `link` role, and an unfilled improved
// anchor is exactly that.
const allAnchors = () => Array.from(document.querySelectorAll('a'));
const mainAnchor = () => allAnchors()[0];

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return this;
	});
});

describe('IconPicker', () => {
	// Vanilla appends both improved anchors once, at every `states`, and gates only the fill. An
	// unfilled one has no href, which is what `.icon-input-improved:not([href])` hides.
	it('renders all three anchors at every states, filled or not', () => {
		const settings = new Settings(0);
		const { rerender } = render(<IconPicker modObject={settings} config={configFor()} />);
		expect(allAnchors()).toHaveLength(3);

		rerender(<IconPicker modObject={settings} config={configFor({ states: 3, improvedId })} />);
		expect(allAnchors()).toHaveLength(3);

		rerender(<IconPicker modObject={settings} config={configFor({ states: 4, improvedId, improvedId2 })} />);
		expect(allAnchors()).toHaveLength(3);
	});

	it('leaves an improved anchor without an href or a background until its states gate is met', () => {
		const settings = new Settings(0);
		const { rerender } = render(<IconPicker modObject={settings} config={configFor({ states: 2, improvedId })} />);
		const improved = () => allAnchors()[1];
		expect(improved().hasAttribute('href')).toBe(false);
		expect(improved().style.backgroundImage).toBe('');

		rerender(<IconPicker modObject={settings} config={configFor({ states: 3, improvedId })} />);
		expect(improved().getAttribute('href')).toBe(ActionId.makeSpellUrl(2));
		expect(improved().style.backgroundImage).toContain('improved.jpg');
	});

	// use-counter is added for states > 2 regardless of improvedId, but the counter TEXT only
	// renders when there is no improvedId and states > 3 (or states === 0). At states === 3 with
	// no improvedId the class is present and the text is empty — reproduce that asymmetry exactly.
	it('shows the use-counter class but no text at states 3 without an improved id', () => {
		const settings = new Settings(2);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(mainAnchor().classList.contains('use-counter')).toBe(true);
		expect(screen.queryByText('2')).toBeNull();
	});

	it('shows the counter text at states 4 without an improved id', () => {
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
		expect(mainAnchor().classList.contains('active')).toBe(true);
		expect(document.querySelector('.icon-picker-label')!.classList.contains('active')).toBe(true);
	});

	it('does not mark the main anchor active at zero', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(mainAnchor().classList.contains('active')).toBe(false);
	});

	it('marks only the second improved anchor active, and hides the first, above value 2', () => {
		const settings = new Settings(3);
		render(<IconPicker modObject={settings} config={configFor({ states: 4, improvedId, improvedId2 })} />);
		const [, improved1, improved2] = allAnchors();
		expect(improved1.hidden).toBe(true);
		expect(improved2.hidden).toBe(false);
		expect(improved2.classList.contains('active')).toBe(true);
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

	// Vanilla stores from its source subscription, so it acts on any notification while hidden —
	// not on a transition — and never during construction.
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
		const [main, improved1] = allAnchors();
		expect(main.target).toBe('_blank');
		expect(main.dataset.whtticon).toBe('false');
		expect(main.dataset.disableWowheadTouchTooltip).toBe('true');
		expect(improved1.dataset.whtticon).toBe('false');
		expect(improved1.dataset.disableWowheadTouchTooltip).toBe('true');
	});

	it('marks the first improved anchor active only above value 1', () => {
		const settings = new Settings(1);
		const config = configFor({ states: 3, improvedId });
		const { rerender } = render(<IconPicker modObject={settings} config={config} />);
		expect(allAnchors()[1].classList.contains('active')).toBe(false);

		act(() => settings.set(2));
		rerender(<IconPicker modObject={settings} config={config} />);
		expect(allAnchors()[1].classList.contains('active')).toBe(true);
	});

	it('hides the second improved anchor until value 3, and only when states 4 configures it', () => {
		const settings = new Settings(2);
		const config = configFor({ states: 4, improvedId, improvedId2 });
		const { rerender } = render(<IconPicker modObject={settings} config={config} />);
		expect(allAnchors()[2].hidden).toBe(true);

		act(() => settings.set(3));
		rerender(<IconPicker modObject={settings} config={config} />);
		expect(allAnchors()[2].hidden).toBe(false);

		// states 3 never touches either anchor's `hidden`, so neither is hidden.
		rerender(<IconPicker modObject={settings} config={configFor({ states: 3, improvedId })} />);
		expect(allAnchors()[1].hidden).toBe(false);
		expect(allAnchors()[2].hidden).toBe(false);
	});

	it('hides the counter label at states 2 and shows it above', () => {
		const settings = new Settings(0);
		const { rerender } = render(<IconPicker modObject={settings} config={configFor()} />);
		const label = () => document.querySelector('.icon-picker-label')!;
		expect(label().classList.contains('hide')).toBe(true);

		rerender(<IconPicker modObject={settings} config={configFor({ states: 3 })} />);
		expect(label().classList.contains('hide')).toBe(false);
	});

	it('writes the disabled attribute on the anchor as well as the class on the root', () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(mainAnchor().hasAttribute('disabled')).toBe(true);
		expect(document.querySelector('.icon-picker-root')!.classList.contains('disabled')).toBe(true);
	});

	it("renders the level container as the anchor's next sibling, so no anchor sits inside another", () => {
		const settings = new Settings(0);
		render(<IconPicker modObject={settings} config={configFor({ states: 4, improvedId, improvedId2 })} />);
		const root = document.querySelector('.icon-picker-root')!;
		const anchor = root.querySelector(':scope > a.icon-picker-button')!;
		const container = root.querySelector('.icon-input-level-container')!;

		expect(anchor.nextElementSibling).toBe(container);
		expect(anchor.contains(container)).toBe(false);
		expect(anchor.children).toHaveLength(0);
		expect(document.querySelectorAll('a a')).toHaveLength(0);
	});

	it('keeps the improved anchors and the counter inside the container, with their href and hidden intact', () => {
		const settings = new Settings(3);
		render(<IconPicker modObject={settings} config={configFor({ states: 4, improvedId, improvedId2 })} />);
		const container = document.querySelector('.icon-input-level-container')!;
		const [improved1, improved2] = Array.from(container.querySelectorAll('a'));

		expect(container.children).toHaveLength(3);
		expect(improved1.getAttribute('href')).toBe(ActionId.makeSpellUrl(2));
		expect(improved2.getAttribute('href')).toBe(ActionId.makeSpellUrl(3));
		expect(improved1.hidden).toBe(true);
		expect(improved2.hidden).toBe(false);
		expect(container.querySelector('.icon-picker-label')).toBeTruthy();
	});

	// The container overlays the anchor rather than living inside it, so what used to reach the picker
	// by bubbling has to be carried on both: otherwise a click on an improved icon leaves the value
	// alone and follows the wowhead link instead.
	it('left-clicks, right-clicks and suppresses the context menu from the container as well', () => {
		const settings = new Settings(1);
		render(<IconPicker modObject={settings} config={configFor({ states: 3, improvedId })} />);
		const improved = document.querySelector('.icon-input-improved1')!;
		const container = document.querySelector('.icon-input-level-container')!;

		fireEvent.click(improved);
		expect(settings.level).toBe(2);

		fireEvent.mouseDown(improved, { button: 2 });
		expect(settings.level).toBe(1);

		// fireEvent returns false when preventDefault() was called.
		expect(fireEvent.contextMenu(container)).toBe(false);
		expect(fireEvent.click(container)).toBe(false);
		expect(settings.level).toBe(2);
	});
});
