import type { ActionId } from '@sim/proto/action_id';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionLink } from './ActionLink';

const tooltipData = vi.hoisted(() => vi.fn(() => Promise.resolve('spell=12345')));
vi.mock('@sim/proto/action_id/tooltip_data', () => ({ actionIdWowheadTooltipData: tooltipData }));

const actionId = (extra: Record<string, unknown> = {}) =>
	({
		name: 'Mortal Strike',
		iconUrl: 'https://wow.zamimg.com/ms.jpg',
		spellId: 12294,
		itemId: 0,
		reforgeId: 0,
		randomSuffixId: 0,
		upgradeStep: 0,
		spellIdTooltipOverride: 0,
		anyId: () => true,
		equalityKey: () => 'spell-12294',
		...extra,
	}) as unknown as ActionId;

const anchor = (container: HTMLElement) => container.querySelector('a.log-action') as HTMLAnchorElement;

describe('ActionLink', () => {
	it('renders the icon and the name inside one anchor', () => {
		const { container } = render(<ActionLink actionId={actionId()} />);

		expect(anchor(container).textContent).toBe(' Mortal Strike');
		expect(anchor(container).querySelector<HTMLElement>('.icon.icon-sm')!.style.backgroundImage).toContain('https://wow.zamimg.com/ms.jpg');
	});

	it('opens Wowhead in a new tab without handing it a window opener', () => {
		const { container } = render(<ActionLink actionId={actionId()} />);

		expect(anchor(container).getAttribute('target')).toBe('_blank');
		expect(anchor(container).getAttribute('href')).toContain('spell=12294');
		expect(anchor(container).getAttribute('rel')).toBe('noopener noreferrer');
	});

	// The anchor, not the icon, is what Wowhead's script reads; the tooltip it draws is appended to
	// <body>, which is why a row inside the virtual list's transform is safe to hold one.
	it('writes the resolved tooltip onto the anchor', async () => {
		const { container } = render(<ActionLink actionId={actionId()} />);

		await waitFor(() => expect(anchor(container).getAttribute('data-wowhead')).toBe('spell=12345'));
	});

	it('asks for the buff aura when the line is an aura line', () => {
		tooltipData.mockClear();
		render(<ActionLink actionId={actionId()} isAura />);

		expect(tooltipData).toHaveBeenCalledWith(expect.anything(), { useBuffAura: true });
	});
});
