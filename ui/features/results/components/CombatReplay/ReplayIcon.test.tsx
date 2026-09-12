import { render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReplayIcon } from './ReplayIcon';
import { actionId } from './testing';

const tooltipData = vi.hoisted(() => vi.fn(() => Promise.resolve('spell=1')));
vi.mock('@sim/proto/action_id/tooltip_data', () => ({ actionIdWowheadTooltipData: tooltipData }));

const mount = (element: ReactElement) => render(element).container.querySelector<HTMLAnchorElement>('a')!;

describe('ReplayIcon', () => {
	it('paints the action’s icon and links to it, hardened against the cross-origin opener', () => {
		const icon = mount(<ReplayIcon actionId={actionId('Fireball')} className="cr-strip-icon" tooltip="spell" />);

		expect(icon.style.backgroundImage).toContain('Fireball.png');
		expect(icon.getAttribute('href')).toContain('wowhead');
		expect(icon.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('takes a class list and keeps the caller’s own style alongside the icon', () => {
		const icon = mount(
			<ReplayIcon actionId={actionId('Fireball')} className={['cr-strip-icon', 'cr-strip-icon-active']} tooltip="spell" style={{ opacity: 0.5 }} />,
		);

		expect(icon.className).toBe('cr-strip-icon cr-strip-icon-active');
		expect(icon.style.opacity).toBe('0.5');
		expect(icon.style.backgroundImage).toContain('Fireball.png');
	});

	it('links nowhere and shows no tooltip for a cast with no action behind it', () => {
		tooltipData.mockClear();
		const icon = mount(<ReplayIcon actionId={null} className="cr-action-icon" tooltip="spell" />);

		expect(icon.getAttribute('href')).toBeNull();
		expect(icon.style.backgroundImage).toBe('');
		expect(tooltipData).not.toHaveBeenCalled();
	});

	it('resolves an aura’s tooltip against the buff and a cast’s against the spell', async () => {
		tooltipData.mockClear();
		const cast = mount(<ReplayIcon actionId={actionId('Fireball')} className="cr-strip-icon" tooltip="spell" />);
		expect(tooltipData).toHaveBeenCalledWith(expect.anything(), { useBuffAura: false });
		await waitFor(() => expect(cast.dataset.wowhead).toBe('spell=1'));

		mount(<ReplayIcon actionId={actionId('Enrage')} className="cr-aura-icon" tooltip="buffAura" />);
		expect(tooltipData).toHaveBeenLastCalledWith(expect.anything(), { useBuffAura: true });
	});

	// The anchor a caller hands in has to be the anchor that renders: every per-frame highlight in the
	// replay is a `classList.toggle` on it, and a ref left pointing at nothing toggles nothing while
	// every other assertion still passes.
	it('renders into the anchor its caller passed, and its own when there is none', async () => {
		const anchorRef = createRef<HTMLAnchorElement>();
		const icon = mount(<ReplayIcon actionId={actionId('Fireball')} className="cr-aura-icon" tooltip="buffAura" anchorRef={anchorRef} />);

		expect(anchorRef.current).toBe(icon);
		await waitFor(() => expect(anchorRef.current!.dataset.wowhead).toBe('spell=1'));
	});

	it('renders its children inside the anchor', () => {
		const icon = mount(
			<ReplayIcon actionId={actionId('Fireball')} className="cr-strip-icon" tooltip="spell">
				<span className="cr-dmg-badge">1.5k</span>
			</ReplayIcon>,
		);

		expect(icon.querySelector('.cr-dmg-badge')!.textContent).toBe('1.5k');
	});
});
