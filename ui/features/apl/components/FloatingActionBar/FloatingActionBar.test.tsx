import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FloatingActionBar } from './FloatingActionBar';

vi.mock('@i18n/config', () => ({ default: { t: (key: string, opts?: Record<string, unknown>) => (opts?.itemName ? `${key}:${opts.itemName}` : key) } }));

class FakeIntersectionObserver {
	static instances: Array<FakeIntersectionObserver> = [];
	callback: IntersectionObserverCallback;
	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
		FakeIntersectionObserver.instances.push(this);
	}
	observe = vi.fn();
	disconnect = vi.fn();
	unobserve = vi.fn();
	fire() {
		this.callback([] as Array<IntersectionObserverEntry>, this as unknown as IntersectionObserver);
	}
}

const applyEmptyAplRotation = vi.fn();
const host = { rootElem: document.body, applyEmptyAplRotation } as never;

const mount = (props: Partial<Parameters<typeof FloatingActionBar>[0]> = {}) => {
	const scrollRoot = document.createElement('div');
	document.body.appendChild(scrollRoot);
	return render(
		<SimHostProvider host={host}>
			<FloatingActionBar itemName="Action" onCreate={() => {}} {...props} />
		</SimHostProvider>,
		{ container: scrollRoot },
	);
};

const newButton = () => screen.getByRole('button', { name: /rotation_tab\.apl\.floatingActionBar\.new/ });
const resetButton = () => screen.getByRole('button', { name: 'rotation_tab.apl.floatingActionBar.reset' });

beforeEach(() => {
	FakeIntersectionObserver.instances = [];
	applyEmptyAplRotation.mockClear();
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('FloatingActionBar', () => {
	it('calls onCreate with no argument immediately when there is no nameDialog', () => {
		const onCreate = vi.fn();
		mount({ onCreate });

		fireEvent.click(newButton());
		expect(onCreate).toHaveBeenCalledWith();
	});

	it('opens the dialog and calls onCreate with the submitted name, reading existingNames at open time', () => {
		const onCreate = vi.fn();
		let names = ['First'];
		mount({
			onCreate,
			nameDialog: { inputLabel: 'Name', existingNames: () => names },
		});

		names = ['First', 'Second'];

		act(() => {
			fireEvent.click(newButton());
		});

		const input = screen.getByRole('textbox') as HTMLInputElement;
		act(() => {
			fireEvent.change(input, { target: { value: 'Second' } });
		});
		expect((screen.getByRole('button', { name: 'rotation_tab.apl.nameModal.create' }) as HTMLButtonElement).disabled).toBe(true);

		act(() => {
			fireEvent.change(input, { target: { value: 'Third' } });
		});
		act(() => {
			fireEvent.click(screen.getByRole('button', { name: 'rotation_tab.apl.nameModal.create' }));
		});
		expect(onCreate).toHaveBeenCalledWith('Third');
	});

	it('calls host.applyEmptyAplRotation() from the reset button', () => {
		mount();

		fireEvent.click(resetButton());
		expect(applyEmptyAplRotation).toHaveBeenCalledTimes(1);
	});

	it('toggles the stuck class on each IntersectionObserver delivery', () => {
		const { container } = mount();
		const root = container.querySelector('.apl-floating-action-bar-root') as HTMLElement;
		expect(root.classList.contains('stuck')).toBe(false);

		const observer = FakeIntersectionObserver.instances[0];
		act(() => observer.fire());
		expect(root.classList.contains('stuck')).toBe(true);

		act(() => observer.fire());
		expect(root.classList.contains('stuck')).toBe(false);
	});
});
