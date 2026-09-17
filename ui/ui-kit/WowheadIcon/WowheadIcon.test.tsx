import { ActionId } from '@sim/proto/action_id';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WowheadIcon } from './WowheadIcon';

const tooltipData = vi.hoisted(() => vi.fn(() => Promise.resolve('spell=1')));
vi.mock('@sim/proto/action_id/tooltip_data', () => ({ actionIdWowheadTooltipData: tooltipData }));

const actionId = () => Object.assign(Object.create(ActionId.prototype), { spellId: 1, itemId: 0 }) as ActionId;

describe('WowheadIcon', () => {
	it('renders an anchor by default, and a div when asked for one', () => {
		const anchor = render(<WowheadIcon iconUrl="icon.jpg" href="https://wowhead/spell=1" />).container.firstElementChild!;
		expect(anchor.tagName).toBe('A');

		const div = render(<WowheadIcon as="div" iconUrl="icon.jpg" />).container.firstElementChild!;
		expect(div.tagName).toBe('DIV');
	});

	it('paints the background image and forwards href and rel', () => {
		const icon = render(<WowheadIcon iconUrl="icon.jpg" href="https://wowhead/spell=1" />).container.querySelector('a')!;
		expect(icon.style.backgroundImage).toBe('url("icon.jpg")');
		expect(icon.getAttribute('href')).toBe('https://wowhead/spell=1');
		expect(icon.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('merges the className onto the element', () => {
		const icon = render(<WowheadIcon className="rotation-row-icon" />).container.querySelector('a')!;
		expect(icon.classList.contains('rotation-row-icon')).toBe(true);
	});

	it('writes the wowhead tooltip dataset for an action id', async () => {
		tooltipData.mockClear();
		const id = actionId();
		const icon = render(<WowheadIcon iconUrl="icon.jpg" actionId={id} useBuffAura />).container.querySelector('a')!;

		expect(tooltipData).toHaveBeenCalledWith(id, { useBuffAura: true });
		await waitFor(() => expect(icon.getAttribute('data-wowhead')).toBe('spell=1'));
	});
});
