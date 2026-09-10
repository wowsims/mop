import { Tabs } from '@base-ui/react/tabs';
import type { AplPaneId } from '@features/apl/model/apl_panes';
import { fireEvent, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
// The picker is tested where it lives. What is under test here is that it is the navbar's first
// child, because the strip's `margin-left: auto` is what pushes the tabs to the other end.
vi.mock('@features/apl/components/RotationTypePicker', () => ({ RotationTypePicker: () => <div className="rotation-type-picker-stub" /> }));

class FakeIntersectionObserver {
	static instances: Array<FakeIntersectionObserver> = [];
	constructor(readonly callback: IntersectionObserverCallback) {
		FakeIntersectionObserver.instances.push(this);
	}
	observe = vi.fn();
	disconnect = vi.fn();
	unobserve = vi.fn();
	fire(...ratios: Array<number>) {
		const entries = ratios.map(intersectionRatio => ({ intersectionRatio }));
		this.callback(entries as unknown as Array<IntersectionObserverEntry>, this as unknown as IntersectionObserver);
	}
}

const header = document.createElement('div');

const { StickyHeaderContext } = await import('@ui-kit/hooks/useStickyToolbar');
const { AplNavbar } = await import('./AplNavbar');

const mount = (activeId: AplPaneId = 'apl-priority-list', onSelect = vi.fn()) => ({
	onSelect,
	...render(
		<StickyHeaderContext value={header}>
			<Tabs.Root value={activeId} onValueChange={next => onSelect(next as AplPaneId)}>
				<AplNavbar />
			</Tabs.Root>
		</StickyHeaderContext>,
	),
});

const tabs = (container: HTMLElement) => [...container.querySelectorAll<HTMLButtonElement>('[role=tab]')];

beforeEach(() => {
	FakeIntersectionObserver.instances = [];
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('AplNavbar', () => {
	it('puts the rotation-type picker ahead of the strip, in one sticky row', () => {
		const { container } = mount();
		const root = container.querySelector('.apl-rotation-navbar')!;
		expect(root.className).toBe('apl-rotation-navbar sticky-toolbar-root');
		expect([...root.children].map(child => child.className)).toEqual(['rotation-type-container', 'nav nav-tabs']);
		expect(root.querySelector('.rotation-type-container > .rotation-type-picker-stub')).not.toBeNull();
	});

	it('renders the three sub-tabs with the active one selected and the only Tab stop', () => {
		const { container } = mount('apl-action-groups');
		expect(container.querySelector('.nav-tabs')!.getAttribute('role')).toBe('tablist');
		expect([...container.querySelectorAll('.nav-item')].map(item => item.getAttribute('role'))).toEqual(['presentation', 'presentation', 'presentation']);
		expect(tabs(container).map(tab => [tab.getAttribute('aria-controls'), tab.className, tab.getAttribute('aria-selected'), tab.tabIndex])).toEqual([
			['apl-priority-list', 'nav-link', 'false', -1],
			['apl-action-groups', 'nav-link active', 'true', 0],
			['apl-variables', 'nav-link', 'false', -1],
		]);
		expect(tabs(container).every(tab => tab.getAttribute('type') === 'button')).toBe(true);
	});

	it('reports a click as the pane it controls', () => {
		const { container, onSelect } = mount();
		fireEvent.click(tabs(container)[2]);
		expect(onSelect).toHaveBeenCalledWith('apl-variables');
	});

	// The arrow walk itself belongs to a browser: Base UI drives it through a composite that does not
	// answer synthetic key events under happy-dom. What is checkable here is the roving tabindex the
	// walk moves along - exactly one stop, and it follows the selection.
	it('leaves one tab stop on the strip and moves it with the selection', () => {
		expect(
			tabs(mount().container)
				.filter(tab => tab.tabIndex === 0)
				.map(tab => tab.getAttribute('aria-controls')),
		).toEqual(['apl-priority-list']);
		expect(
			tabs(mount('apl-variables').container)
				.filter(tab => tab.tabIndex === 0)
				.map(tab => tab.getAttribute('aria-controls')),
		).toEqual(['apl-variables']);
	});

	it('leaves a key it does not own to the page', () => {
		const { container, onSelect } = mount();
		const handled = fireEvent.keyDown(container.querySelector('.nav-tabs')!, { key: 'Enter' });
		expect(onSelect).not.toHaveBeenCalled();
		expect(handled).toBe(true);
	});

	it('carries stuck while the row no longer fits below the header', () => {
		const { container } = mount();
		const root = container.querySelector('.apl-rotation-navbar')!;
		Object.defineProperty(root, 'clientHeight', { value: 40 });
		act(() => FakeIntersectionObserver.instances.at(-1)!.fire(0.5));
		expect(root.className).toBe('apl-rotation-navbar sticky-toolbar-root stuck');
		act(() => FakeIntersectionObserver.instances.at(-1)!.fire(1));
		expect(root.className).toBe('apl-rotation-navbar sticky-toolbar-root');
	});

	it('reads the last record of a delivery, not the first', () => {
		const { container } = mount();
		const root = container.querySelector('.apl-rotation-navbar')!;
		Object.defineProperty(root, 'clientHeight', { value: 40 });
		act(() => FakeIntersectionObserver.instances.at(-1)!.fire(1, 0.5));
		expect(root.className).toBe('apl-rotation-navbar sticky-toolbar-root stuck');
		act(() => FakeIntersectionObserver.instances.at(-1)!.fire(0.5, 1));
		expect(root.className).toBe('apl-rotation-navbar sticky-toolbar-root');
	});

	it('stays unstuck while the row is not laid out, whatever the ratio says', () => {
		const { container } = mount();
		act(() => FakeIntersectionObserver.instances.at(-1)!.fire(0));
		expect(container.querySelector('.apl-rotation-navbar')!.className).toBe('apl-rotation-navbar sticky-toolbar-root');
	});

	it('disconnects the observer on unmount', () => {
		const { unmount } = mount();
		const observer = FakeIntersectionObserver.instances.at(-1)!;
		unmount();
		expect(observer.disconnect).toHaveBeenCalled();
	});
});
