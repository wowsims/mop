// DEFECT FIXED. `open()` pushed four listener-removers onto `onHideCallbacks` and nothing ever
// cleared them, so the array grew without bound across open/close cycles — and every stale entry
// still ran on the next hide. The four are registered per open now; `onHideCallbacks` stays the
// caller's list and is not touched.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bootstrap', () => ({
	Modal: class {
		show() {}
		hide() {}
	},
}));

const { BaseModal } = await import('./base_modal');

class Probe extends BaseModal {
	hide() {
		this.onHide(new Event('hide.bs.modal'));
	}
}

let parent: HTMLElement;

const cycle = (modal: Probe, times: number) => {
	for (let i = 0; i < times; i++) {
		modal.open();
		modal.hide();
	}
};

describe('BaseModal', () => {
	beforeEach(() => {
		parent = document.createElement('div');
		document.body.appendChild(parent);
	});

	it('does not accumulate hide callbacks across open/close cycles', () => {
		const modal = new Probe(parent, 'probe-modal', { disposeOnClose: false });
		cycle(modal, 5);
		expect(modal.onHideCallbacks).toHaveLength(0);
	});

	it('keeps running the callbacks its caller registered, once each per hide', () => {
		const modal = new Probe(parent, 'probe-modal', { disposeOnClose: false });
		const onHide = vi.fn();
		modal.addOnHideCallback(onHide);

		cycle(modal, 3);

		expect(modal.onHideCallbacks).toEqual([onHide]);
		expect(onHide).toHaveBeenCalledTimes(3);
	});

	// The growth was not only a leak: every stale remover ran on every later hide, and the listener
	// each one removed was the one the *current* open had registered.
	it('removes the document Escape listener exactly once per hide', () => {
		const modal = new Probe(parent, 'probe-modal', { disposeOnClose: false });
		const close = vi.spyOn(modal, 'close');

		modal.open();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(close).toHaveBeenCalledTimes(1);

		modal.hide();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(close).toHaveBeenCalledTimes(1);
	});
});
