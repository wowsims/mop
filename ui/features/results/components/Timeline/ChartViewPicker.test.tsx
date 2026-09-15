import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChartViewPicker } from './ChartViewPicker';

const mount = (value: 'rotation' | 'dps') => {
	const onChange = vi.fn();
	return { onChange, ...render(<ChartViewPicker value={value} onChange={onChange} />) };
};

describe('ChartViewPicker', () => {
	it('offers the two views as one radio group', () => {
		const { container } = mount('rotation');
		const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type=radio]')];
		expect(inputs.map(input => input.value)).toEqual(['rotation', 'dps']);
		expect(new Set(inputs.map(input => input.name)).size).toBe(1);
		expect([...container.querySelectorAll('label')].map(label => label.htmlFor)).toEqual(['timeline-chart-view-rotation', 'timeline-chart-view-dps']);
	});

	it('checks the view it is given, not the one that was clicked last', () => {
		expect(mount('dps').container.querySelector<HTMLInputElement>('#timeline-chart-view-dps')!.checked).toBe(true);
		expect(mount('dps').container.querySelector<HTMLInputElement>('#timeline-chart-view-rotation')!.checked).toBe(false);
	});

	it('reports the picked view', () => {
		const { container, onChange } = mount('rotation');
		fireEvent.click(container.querySelector('#timeline-chart-view-dps')!);
		expect(onChange).toHaveBeenCalledWith('dps');
	});
});
