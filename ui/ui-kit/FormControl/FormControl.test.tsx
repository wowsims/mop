import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { FieldLabel, HelpText, INPUT_CLASSES, TextArea } from './index';

describe('FieldLabel', () => {
	it('renders a label by default with htmlFor', () => {
		render(<FieldLabel htmlFor="thing">Name</FieldLabel>);
		const label = screen.getByText('Name');
		expect(label.tagName).toBe('LABEL');
		expect(label.getAttribute('for')).toBe('thing');
		expect(label.className).toContain('text-ui');
	});

	it('renders as a span or div without htmlFor', () => {
		render(<FieldLabel as="span">Group</FieldLabel>);
		const span = screen.getByText('Group');
		expect(span.tagName).toBe('SPAN');
		expect(span.hasAttribute('for')).toBe(false);
	});

	it('applies additive className', () => {
		render(<FieldLabel className="extra">Name</FieldLabel>);
		expect(screen.getByText('Name').className).toContain('extra');
	});
});

describe('HelpText', () => {
	it('renders as a div by default', () => {
		render(<HelpText>Help</HelpText>);
		const el = screen.getByText('Help');
		expect(el.tagName).toBe('DIV');
		expect(el.className).toContain('text-gray-600');
	});

	it('renders as a p and forwards hidden', () => {
		render(
			<HelpText as="p" hidden>
				Help
			</HelpText>,
		);
		const el = screen.getByText('Help');
		expect(el.tagName).toBe('P');
		expect(el.hasAttribute('hidden')).toBe(true);
	});
});

describe('TextArea', () => {
	it('forwards ref and attributes and applies INPUT_CLASSES', () => {
		const ref = createRef<HTMLTextAreaElement>();
		render(<TextArea ref={ref} spellCheck={false} data-testid="textarea" />);
		const textarea = screen.getByTestId('textarea');
		expect(ref.current).toBe(textarea);
		expect(textarea.getAttribute('spellcheck')).toBe('false');
		INPUT_CLASSES.split(' ').forEach(cls => expect(textarea.className).toContain(cls));
	});
});
