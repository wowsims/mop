import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { FieldLabel, HelpText, Input, Select, TextArea } from './index';

describe('FieldLabel', () => {
	it('renders a label by default with htmlFor', () => {
		render(<FieldLabel htmlFor="thing">Name</FieldLabel>);
		const label = screen.getByText('Name');
		expect(label.tagName).toBe('LABEL');
		expect(label.getAttribute('for')).toBe('thing');
		expect(label.className).toContain('ui-field-label');
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

	it('sets data-testid from testId and forwards other native props', () => {
		render(
			<FieldLabel testId="cooldown-picker-label" title="Bloodlust">
				Name
			</FieldLabel>,
		);
		const label = screen.getByTestId('cooldown-picker-label');
		expect(label.getAttribute('title')).toBe('Bloodlust');
	});
});

describe('HelpText', () => {
	it('renders as a div by default', () => {
		render(<HelpText>Help</HelpText>);
		const el = screen.getByText('Help');
		expect(el.tagName).toBe('DIV');
		expect(el.className).toContain('ui-help-text');
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
	it('forwards ref and attributes and applies the shared input base classes', () => {
		const ref = createRef<HTMLTextAreaElement>();
		render(<TextArea ref={ref} spellCheck={false} data-testid="textarea" />);
		const textarea = screen.getByTestId('textarea');
		expect(ref.current).toBe(textarea);
		expect(textarea.getAttribute('spellcheck')).toBe('false');
		expect(textarea.className).toContain('ui-input');
	});

	it('keeps className additive', () => {
		render(<TextArea className="extra" data-testid="textarea" />);
		const textarea = screen.getByTestId('textarea');
		expect(textarea.className).toContain('extra');
		expect(textarea.className).toContain('ui-input');
	});
});

describe('Input', () => {
	it('renders a native input, forwards ref and attributes, and applies the shared base classes', () => {
		const ref = createRef<HTMLElement>();
		render(<Input ref={ref} type="text" className="extra" data-testid="input" />);
		const input = screen.getByTestId('input');
		expect(input.tagName).toBe('INPUT');
		expect(ref.current).toBe(input);
		expect(input.className).toContain('extra');
		expect(input.className).toContain('ui-input');
	});
});

describe('Select', () => {
	it('renders a native select, forwards ref and attributes, and applies the shared base classes', () => {
		const ref = createRef<HTMLElement>();
		render(
			<Select ref={ref} className="extra" data-testid="select">
				<option value="1">one</option>
			</Select>,
		);
		const select = screen.getByTestId('select');
		expect(select.tagName).toBe('SELECT');
		expect(ref.current).toBe(select);
		expect(select.className).toContain('extra');
		expect(select.className).toContain('ui-select');
	});
});
