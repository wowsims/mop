import { render } from '@testing-library/react';
import { iconGridColumns } from '@ui-kit/icon_inputs';
import { describe, expect, it, vi } from 'vitest';

import { RotationIconGroup } from './RotationIconGroup';

vi.mock('@sim/context/SimHostContext', () => ({ usePlayer: () => ({}) }));
vi.mock('@ui-kit/IconPicker', () => ({ IconPicker: () => <div className="icon-picker-root" /> }));
vi.mock('@ui-kit/IconEnumPicker', () => ({ IconEnumPicker: () => <div className="icon-enum-picker-root" /> }));

const icon = (type: 'icon' | 'iconEnum') => ({ type }) as never;

describe('iconGridColumns', () => {
	it('gives an empty row no columns of its own, because vanilla never styled one', () => {
		expect(iconGridColumns(0)).toBeUndefined();
	});

	it('gives four or fewer icons one column each', () => {
		expect([1, 2, 3, 4].map(iconGridColumns)).toEqual(['repeat(1, 1fr)', 'repeat(2, 1fr)', 'repeat(3, 1fr)', 'repeat(4, 1fr)']);
	});

	it('splits five to seven icons over two rows, rounding up', () => {
		expect([5, 6, 7].map(iconGridColumns)).toEqual(['repeat(3, 1fr)', 'repeat(3, 1fr)', 'repeat(4, 1fr)']);
	});

	it('leaves eight or more to the stylesheet', () => {
		expect([8, 12].map(iconGridColumns)).toEqual([undefined, undefined]);
	});
});

describe('RotationIconGroup', () => {
	const group = () => document.querySelector('.rotation-icon-group') as HTMLElement;

	it('wears the three classes the vanilla group container had', () => {
		render(<RotationIconGroup inputs={[]} />);

		expect(group().className.split(' ').sort()).toEqual(['icon-group', 'picker-group', 'rotation-icon-group']);
	});

	it('picks the picker each input type names, in order', () => {
		render(<RotationIconGroup inputs={[icon('icon'), icon('iconEnum'), icon('icon')]} />);

		expect([...group().children].map(child => child.className)).toEqual(['icon-picker-root', 'icon-enum-picker-root', 'icon-picker-root']);
	});

	it('sets the column count from how many icons there are', () => {
		render(<RotationIconGroup inputs={[icon('icon'), icon('icon')]} />);

		expect(group().style.gridTemplateColumns).toBe('repeat(2, 1fr)');
	});

	it('leaves an empty group without an inline column rule', () => {
		render(<RotationIconGroup inputs={[]} />);

		expect(group().getAttribute('style')).toBeNull();
	});
});
