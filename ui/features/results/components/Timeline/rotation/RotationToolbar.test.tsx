import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RotationToolbar } from './RotationToolbar';

describe('RotationToolbar', () => {
	it('runs the four zoom actions in the order they are drawn, each labelled and tooltipped', () => {
		const handlers = { onZoomOut: vi.fn(), onZoomIn: vi.fn(), onFit: vi.fn(), onReset: vi.fn() };
		const { container } = render(<RotationToolbar {...handlers} />);
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="rotation-zoom-button"]')];

		expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
			'results_tab.details.timeline.chart_options.zoom_out',
			'results_tab.details.timeline.chart_options.zoom_in',
			'results_tab.details.timeline.chart_options.fit',
			'results_tab.details.timeline.chart_options.reset',
		]);
		// One tooltip serves the group; the label rides on each anchor.
		expect(new Set(buttons.map(button => button.dataset.tooltipId)).size).toBe(1);
		expect(buttons[0].dataset.tooltipContent).toBe('results_tab.details.timeline.chart_options.zoom_out');

		const expected = [handlers.onZoomOut, handlers.onZoomIn, handlers.onFit, handlers.onReset];
		buttons.forEach((button, index) => {
			fireEvent.click(button);
			expect(expected.map(handler => handler.mock.calls.length)).toEqual(expected.map((_unused, other) => (other <= index ? 1 : 0)));
		});
	});
});
