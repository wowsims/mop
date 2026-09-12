import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RotationToolbar } from './RotationToolbar';

describe('RotationToolbar', () => {
	it('runs the four zoom actions in the order they are drawn, each labelled and tooltipped', () => {
		const handlers = { onZoomOut: vi.fn(), onZoomIn: vi.fn(), onFit: vi.fn(), onReset: vi.fn() };
		const { container } = render(<RotationToolbar {...handlers} />);
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('.rotation-zoom-button')];

		expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
			'results_tab.details.timeline.chart_options.zoom_out',
			'results_tab.details.timeline.chart_options.zoom_in',
			'results_tab.details.timeline.chart_options.fit',
			'results_tab.details.timeline.chart_options.reset',
		]);
		// One tooltip serves the group; the label rides on each anchor.
		expect(new Set(buttons.map(button => button.dataset.tooltipId)).size).toBe(1);
		expect(buttons[0].dataset.tooltipContent).toBe('results_tab.details.timeline.chart_options.zoom_out');

		buttons.forEach(button => fireEvent.click(button));
		expect(Object.values(handlers).every(handler => handler.mock.calls.length === 1)).toBe(true);
	});
});
