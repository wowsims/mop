import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RotationRowIcon } from './RotationRowIcon';
import { actionId } from './testing';

const tooltipData = vi.hoisted(() => vi.fn(() => Promise.resolve('spell=1')));
vi.mock('@sim/proto/action_id/tooltip_data', () => ({ actionIdWowheadTooltipData: tooltipData }));

const mount = (tooltip?: 'spell' | 'buffAura') =>
	render(<RotationRowIcon actionId={actionId('Fireball')} tooltip={tooltip} />).container.querySelector<HTMLAnchorElement>('.rotation-row-icon')!;

describe('RotationRowIcon', () => {
	it('paints the action’s icon and links to it, hardened against the cross-origin opener', () => {
		const icon = mount();
		expect(icon.style.backgroundImage).toContain('Fireball.png');
		expect(icon.getAttribute('href')).toContain('wowhead');
		expect(icon.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('carries a Wowhead tooltip only when it is asked for, and resolves it against the aura when told to', async () => {
		mount();
		expect(tooltipData).not.toHaveBeenCalled();

		const icon = mount('buffAura');
		expect(tooltipData).toHaveBeenCalledWith(expect.anything(), { useBuffAura: true });
		await waitFor(() => expect(icon.dataset.wowhead).toBe('spell=1'));
	});
});
