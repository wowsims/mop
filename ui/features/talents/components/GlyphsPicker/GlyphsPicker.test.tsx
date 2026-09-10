import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { Database } from '@sim/proto/database';
import type { IndividualSimHost } from '@sim/sim_host';
import { classGlyphsConfig } from '@sim/talents/factory';
import { Class, Glyphs } from '@generated/proto/common';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = vi.hoisted(() => new Set<() => void>());

vi.mock('@sim/state/subscriptions', async importOriginal => ({
	...(await importOriginal<typeof import('@sim/state/subscriptions')>()),
	subscribePlayerField: () => (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
}));

const { GlyphsPicker } = await import('./GlyphsPicker');

const CLASS = Class.ClassWarrior;
const config = classGlyphsConfig[CLASS];
const majorIds = Object.keys(config.majorGlyphs).map(Number);
const minorIds = Object.keys(config.minorGlyphs).map(Number);

let glyphs: Glyphs;

const mount = (initial: Partial<Glyphs> = {}) => {
	glyphs = Glyphs.create(initial);
	const player = {
		getClass: () => CLASS,
		getGlyphs: () => Glyphs.clone(glyphs),
		setGlyphs: (next: Glyphs) => {
			glyphs = Glyphs.clone(next);
			listeners.forEach(listener => listener());
		},
	} as unknown as Player<any>;
	const host = { player, rootElem: document.body } as unknown as IndividualSimHost<any>;
	return render(
		<SimHostProvider host={host}>
			<GlyphsPicker />
		</SimHostProvider>,
	);
};

const slots = (kind: 'major' | 'minor') => Array.from(document.querySelectorAll<HTMLElement>(`.${kind}-glyphs .content-block-body .glyph-picker-root`));
const link = (kind: 'major' | 'minor', index: number) => slots(kind)[index].querySelector<HTMLAnchorElement>('.glyph-link')!;
const listItems = () => Array.from(document.querySelectorAll<HTMLLIElement>('.selector-modal-list .selector-modal-list-item'));
const searchBox = () => document.querySelector<HTMLInputElement>('.selector-modal-search')!;
const dialogOpen = () => {
	const modal = document.querySelector('.glyph-modal');
	return modal !== null && !modal.hasAttribute('hidden');
};

const openSlot = async (kind: 'major' | 'minor', index: number) => {
	await waitFor(() => expect(slots(kind)).toHaveLength(3));
	fireEvent.click(link(kind, index));
	await waitFor(() => expect(dialogOpen()).toBe(true));
};

beforeEach(() => {
	listeners.clear();
	vi.spyOn(Database, 'get').mockResolvedValue({ glyphItemToSpellId: (itemId: number) => itemId + 1 } as unknown as Database);
});

describe('GlyphsPicker', () => {
	it('builds three major and three minor slots once the database has loaded', async () => {
		mount();

		expect(slots('major')).toHaveLength(0);
		await waitFor(() => expect(slots('major')).toHaveLength(3));
		expect(slots('minor')).toHaveLength(3);
	});

	// The picker wears `item-picker-root` and its label vocabulary to inherit `_gear_picker.scss`,
	// which stays global. Losing a name here silently loses the styling.
	it('wears the item-picker class names it borrows its stylesheet from', async () => {
		mount();
		await waitFor(() => expect(slots('major')).toHaveLength(3));

		const slot = slots('major')[0];
		expect(slot.className.split(' ')).toEqual(['input-root', 'glyph-picker-root', 'input-inline', 'item-picker-root']);
		expect(slot.querySelector('.glyph-link > img.item-picker-icon')).not.toBeNull();
		expect(slot.querySelector('.item-picker-labels-container > .item-picker-name-container')).not.toBeNull();
	});

	it('offers every major glyph the class has, plus an empty entry', async () => {
		mount();
		await waitFor(() => expect(slots('major')).toHaveLength(3));
		expect(dialogOpen()).toBe(false);

		await openSlot('major', 0);

		expect(listItems()).toHaveLength(majorIds.length + 1);
		expect(document.querySelectorAll('.selector-modal-list-item-link')).toHaveLength(majorIds.length + 1);
	});

	it('offers the minor list when a minor slot opens it', async () => {
		mount();
		await openSlot('minor', 0);

		expect(listItems()).toHaveLength(minorIds.length + 1);
	});

	it('writes the chosen glyph to the slot that opened the dialog', async () => {
		mount();
		await openSlot('major', 1);

		const entry = listItems()[1];
		const name = entry.querySelector('.selector-modal-list-item-name')!.textContent;
		fireEvent.click(entry.querySelector('a')!);

		expect(glyphs.major2).not.toBe(0);
		expect(majorIds).toContain(glyphs.major2);
		expect(glyphs.major1).toBe(0);
		expect(glyphs.major3).toBe(0);
		await waitFor(() => expect(link('major', 1).querySelector('.item-picker-name-container')!.textContent).toBe(name));
		expect(link('major', 1).getAttribute('href')).toContain('wowhead');
	});

	// Vanilla's list anchor writes the value and nothing else, so the dialog stays open for a
	// second pick. Reproduced rather than corrected.
	it('marks the selected entry active and keeps the dialog open', async () => {
		mount();
		await openSlot('major', 0);
		fireEvent.click(listItems()[1].querySelector('a')!);

		await waitFor(() => expect(listItems()[1].classList.contains('active')).toBe(true));
		expect(listItems().filter(item => item.classList.contains('active'))).toHaveLength(1);
		expect(dialogOpen()).toBe(true);
	});

	// Vanilla read the active entry off the picker's resolved glyph, so an id the list does not
	// carry — a glyph imported from another class — fell back to the empty entry.
	it('shows an id the list does not carry as the empty entry, and paints the slot empty', async () => {
		mount({ major1: 1 });
		await openSlot('major', 0);

		expect(listItems()[0].classList.contains('active')).toBe(true);
		expect(listItems().filter(item => item.classList.contains('active'))).toHaveLength(1);
		expect(link('major', 0).querySelector('img')!.getAttribute('src')).toContain('inventoryslot_empty');
	});

	it('clears the slot back to the empty glyph', async () => {
		mount();
		await openSlot('major', 0);
		fireEvent.click(listItems()[1].querySelector('a')!);
		await waitFor(() => expect(glyphs.major1).not.toBe(0));

		fireEvent.click(listItems()[0].querySelector('a')!);

		expect(glyphs.major1).toBe(0);
		await waitFor(() => {
			const anchor = link('major', 0);
			expect(anchor.getAttribute('href')).toBeNull();
			expect(anchor.querySelector('img')!.getAttribute('src')).toContain('inventoryslot_empty');
		});
	});

	it('hides the entries whose name does not carry every search word', async () => {
		mount();
		await openSlot('major', 0);
		const target = listItems()[1].querySelector('.selector-modal-list-item-name')!.textContent!;

		fireEvent.change(searchBox(), { target: { value: target } });

		await waitFor(() => expect(listItems().filter(item => !item.classList.contains('d-none'))).toHaveLength(1));
		expect(listItems()[1].classList.contains('d-none')).toBe(false);

		fireEvent.change(searchBox(), { target: { value: '' } });
		await waitFor(() => expect(listItems().filter(item => item.classList.contains('d-none'))).toHaveLength(0));
	});
});
