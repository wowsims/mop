import { ActionId } from '@domain/proto_utils/action_id';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ActionIdState } from '@ui-kit/hooks/useActionId';
import { describe, expect, it, vi } from 'vitest';

import { MetricsActionCell } from './MetricsActionCell';

const resolved = vi.hoisted(() => ({ state: { iconUrl: '', name: '', href: '', ready: true } as ActionIdState }));
const wowhead = vi.hoisted(() => ({ calls: [] as Array<unknown> }));

vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => resolved.state }));
vi.mock('@domain/proto_utils/action_id/dom', () => ({ setActionIdWowheadDataset: (...args: Array<unknown>) => wowhead.calls.push(args) }));

const actionId = ActionId.empty('Kill Command');

const cell = (props: Partial<Parameters<typeof MetricsActionCell>[0]> = {}) =>
	render(<MetricsActionCell name="Kill Command" actionId={actionId} expandable={false} expanded={false} onToggle={() => {}} {...props} />);

describe('MetricsActionCell', () => {
	it('renders the icon anchor and the name, with no toggle on a row that cannot expand', () => {
		const { container } = cell();

		expect(container.querySelector('.metrics-action a.metrics-action-icon')).not.toBeNull();
		expect(container.querySelector('.metrics-action-name')?.textContent).toBe('Kill Command');
		expect(container.querySelector('.expand-toggle')).toBeNull();
	});

	it('carries the href and background of a resolved action id, and neither of an empty one', () => {
		resolved.state = { iconUrl: '', name: '', href: '', ready: true };
		const empty = cell().container.querySelector<HTMLAnchorElement>('a.metrics-action-icon')!;
		expect(empty.getAttribute('href')).toBeNull();
		expect(empty.style.backgroundImage).toBe('');

		resolved.state = { iconUrl: 'https://icons/kc.jpg', name: 'Kill Command', href: 'https://wowhead/spell=34026', ready: true };
		const filled = cell().container.querySelector<HTMLAnchorElement>('a.metrics-action-icon')!;
		expect(filled.getAttribute('href')).toBe('https://wowhead/spell=34026');
		expect(filled.style.backgroundImage).toBe('url("https://icons/kc.jpg")');
		expect(filled.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('names the icon anchor, which is a link with no text of its own', () => {
		resolved.state = { iconUrl: 'https://icons/kc.jpg', name: 'Kill Command', href: 'https://wowhead/spell=34026', ready: true };
		const icon = cell().container.querySelector<HTMLAnchorElement>('a.metrics-action-icon')!;

		expect(icon.textContent).toBe('');
		expect(icon.getAttribute('aria-label')).toBe('Kill Command');
		expect(screen.getByRole('link', { name: 'Kill Command' })).toBe(icon);
	});

	it('writes the wowhead tooltip dataset for its action id', () => {
		wowhead.calls.length = 0;
		cell({ useBuffAura: true });
		expect(wowhead.calls).toHaveLength(1);
		expect(wowhead.calls[0]).toMatchObject([actionId, expect.anything(), { useBuffAura: true }]);
	});

	it('exposes the toggle as a focusable button reporting its state', () => {
		cell({ expandable: true, expanded: true });
		const toggle = screen.getByRole('button', { name: 'Kill Command' });

		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(toggle.className).toBe('expand-toggle');
		expect(toggle.querySelectorAll('.fa-caret-right, .fa-caret-down')).toHaveLength(2);
		toggle.focus();
		expect(document.activeElement).toBe(toggle);
	});

	it('toggles once when the button is clicked, not twice through the row', () => {
		const onToggle = vi.fn();
		const onRowClick = vi.fn();
		render(
			<div onClick={onRowClick}>
				<MetricsActionCell name="Kill Command" actionId={actionId} expandable={true} expanded={false} onToggle={onToggle} />
			</div>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Kill Command' }));
		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onRowClick).not.toHaveBeenCalled();
	});
});
