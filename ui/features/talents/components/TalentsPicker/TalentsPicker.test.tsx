import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { TalentsConfig } from '@sim/talents/config';
import { fakeHost } from '@sim/testing';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GlyphsPicker', () => ({ GlyphsPicker: () => null }));
vi.mock('./TalentTreePicker', () => ({ TalentTreePicker: () => null }));

const { TalentsPicker } = await import('./TalentsPicker');

let copied: string[];
let talentsString: string;

const mount = () => {
	const player = { getTalentsString: () => talentsString } as unknown as Player<any>;
	const host = fakeHost({ player, rootElem: document.body });
	const config = {
		id: 'talents-picker',
		getValue: () => talentsString,
		setValue: vi.fn(),
		tree: {} as TalentsConfig<Record<string, never>>,
	};
	return render(
		<SimHostProvider host={host}>
			<TalentsPicker config={config} />
		</SimHostProvider>,
	);
};

const button = () => document.querySelector<HTMLButtonElement>('.talents-picker-actions button')!;

beforeEach(() => {
	vi.useFakeTimers();
	copied = [];
	talentsString = 'before';
	vi.stubGlobal('navigator', {
		clipboard: {
			writeText: vi.fn((text: string) => {
				copied.push(text);
				return Promise.resolve();
			}),
		},
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('TalentsPicker copy button', () => {
	// `gear-tab.mjs` selects on `.copy-button` and `_talents_picker.scss` sizes `button.copy-talents`.
	it('keeps the class vocabulary the gates and the stylesheet select on', () => {
		mount();

		expect(button().className.split(' ').sort()).toEqual(['btn', 'btn-outline-primary', 'btn-sm', 'copy-button', 'copy-talents']);
		expect(button().getAttribute('type')).toBe('button');
		// The closed `Tooltip` renders nothing, so the button stays the actions div's only child.
		expect(document.querySelector('.talents-picker-actions')!.children).toHaveLength(1);
		expect(button().getAttribute('data-tooltip-id')).toBeTruthy();
	});

	it('copies the talents string as it reads at click time', () => {
		mount();
		talentsString = 'after';

		fireEvent.click(button());

		expect(copied).toEqual(['after']);
	});

	it('reports the copy in the label, and reverts', () => {
		mount();
		fireEvent.click(button());

		expect(button().querySelector('i')!.className).toContain('fa-check');
		expect(button().textContent).toBe('common.copy_button.copied');

		act(() => void vi.advanceTimersByTime(1500));
		expect(button().querySelector('i')!.className).toContain('fa-copy');
		expect(button().textContent).toBe('talents_tab.copy_button.label');
	});
});
