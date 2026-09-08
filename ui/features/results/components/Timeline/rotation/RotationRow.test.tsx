import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ContentRow, HeaderRow, ResourceRow, SeparatorRow } from '../../../view/timeline/rotation/model';
import { RotationHeaderRow } from './RotationHeaderRow';
import { RotationRow } from './RotationRow';
import { RotationSeparatorRow } from './RotationSeparatorRow';
import { actionId, castItem, castRow } from './testing';

vi.mock('./RotationRowIcon', () => ({
	RotationRowIcon: ({ tooltip }: { tooltip?: string }) => <a className="rotation-row-icon" data-tooltip-kind={tooltip ?? 'none'} />,
}));

const ROW = castRow('cast:a', 'Fire Bolt', [castItem(0, 1), castItem(2, 3), castItem(4, 5)]);

const mount = (row: ContentRow = ROW, items: Array<number> = [0, 2]) => {
	const onHide = vi.fn();
	return { onHide, ...render(<RotationRow row={row} items={items} onHide={onHide} />) };
};

describe('RotationRow', () => {
	it('renders only the items it is handed, keyed by their index in the row', () => {
		const { container } = mount();
		const items = [...container.querySelectorAll<HTMLElement>('.rotation-item-cast')];
		expect(items.map(item => item.dataset.itemIndex)).toEqual(['0', '2']);
	});

	it('carries the row key and height the window measured it at', () => {
		const { container } = mount();
		const row = container.querySelector<HTMLElement>('.rotation-row')!;
		expect(row.dataset.rowKey).toBe('cast:a');
		expect(row.className).toBe('rotation-row rotation-row-cast');
		expect(row.style.getPropertyValue('--row-h')).toBe('32');
	});

	it('asks to hide itself by key, and names the row in the button', () => {
		const { container, onHide } = mount();
		const hide = container.querySelector<HTMLButtonElement>('.rotation-row-hide')!;
		expect(hide.getAttribute('aria-label')).toBe('Hide Fire Bolt');
		fireEvent.click(hide);
		expect(onHide).toHaveBeenCalledWith('cast:a');
	});

	it('resolves an aura row’s icon against the buff aura rather than the spell', () => {
		const aura = { ...ROW, kind: 'aura' } as ContentRow;
		expect(mount(aura, []).container.querySelector<HTMLElement>('.rotation-row-icon')!.dataset.tooltipKind).toBe('buffAura');
		expect(mount(ROW, []).container.querySelector<HTMLElement>('.rotation-row-icon')!.dataset.tooltipKind).toBe('spell');
	});

	it('paints a resource row’s icon from its own url, since it has no action', () => {
		const resource = {
			kind: 'resource',
			key: 'res:mana',
			section: 'player',
			height: 32,
			label: 'Mana',
			icon: 'mana.png',
			cssName: 'mana',
			items: [],
			maxRightUpTo: [],
		} as ResourceRow;
		const icon = mount(resource, []).container.querySelector<HTMLElement>('.rotation-row-icon')!;
		expect(icon.style.backgroundImage).toContain('mana.png');
		expect(icon.dataset.tooltipKind).toBeUndefined();
	});
});

describe('RotationHeaderRow', () => {
	it('labels the section and shows an icon only when it has an action', () => {
		const withIcon = { kind: 'header', key: 'header:a', section: 'a', height: 32, label: 'Target 1', actionId: actionId('Boss') } as HeaderRow;
		expect(render(<RotationHeaderRow row={withIcon} />).container.querySelector('.rotation-row-icon')).not.toBeNull();

		const plain = { ...withIcon, actionId: null } as HeaderRow;
		const { container } = render(<RotationHeaderRow row={plain} />);
		expect(container.querySelector('.rotation-row-icon')).toBeNull();
		expect(container.querySelector('.rotation-label-text')!.textContent).toBe('Target 1');
		expect(container.querySelector('.rotation-row-hide')).toBeNull();
	});
});

describe('RotationSeparatorRow', () => {
	it('is an empty row of its own height', () => {
		const { container } = render(<RotationSeparatorRow row={{ kind: 'separator', key: 'sep:a', section: 'a', height: 17 } as SeparatorRow} />);
		const row = container.querySelector<HTMLElement>('.rotation-row-separator')!;
		expect(row.style.getPropertyValue('--row-h')).toBe('17');
		expect(row.textContent).toBe('');
	});
});
