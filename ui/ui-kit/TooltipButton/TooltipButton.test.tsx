import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipButton } from './TooltipButton';

describe('TooltipButton', () => {
	it('renders the vanilla button, with the extra classes the callers pass', () => {
		render(<TooltipButton tooltip="What this does" className="ms-2" />);
		const button = screen.getByRole('button');
		expect(Array.from(button.classList).sort()).toEqual(['btn', 'btn-link', 'ms-2', 'tooltip-button']);
		expect(button.getAttribute('type')).toBe('button');
		// `Icon` normalises the FA5 spelling the vanilla component uses: fa-question-circle is
		// rendered as its FA6 name.
		expect(button.querySelector('i')!.className).toContain('far fa-circle-question');
	});

	it('takes another glyph, which the vanilla component hardcodes', () => {
		render(<TooltipButton tooltip="Warning" icon="triangle-exclamation" iconStyle="solid" />);
		expect(screen.getByRole('button').querySelector('i')!.className).toContain('fas fa-triangle-exclamation');
	});

	it('shows its tooltip on hover and nothing before', () => {
		render(<TooltipButton tooltip="What this does" />);
		expect(screen.queryByText('What this does')).toBeNull();

		fireEvent.mouseEnter(screen.getByRole('button'));
		expect(screen.getByText('What this does')).toBeTruthy();
	});

	it('gives each button its own tooltip', () => {
		render(
			<>
				<TooltipButton tooltip="First" />
				<TooltipButton tooltip="Second" />
			</>,
		);
		const [first, second] = screen.getAllByRole('button');
		expect(first.dataset.tooltipId).not.toBe(second.dataset.tooltipId);

		fireEvent.mouseEnter(second);
		expect(screen.getByText('Second')).toBeTruthy();
		expect(screen.queryByText('First')).toBeNull();
	});
});
