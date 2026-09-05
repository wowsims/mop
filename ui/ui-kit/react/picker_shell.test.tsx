import { fireEvent, render, screen } from '@testing-library/react';
import type { InputConfig } from '@ui-kit/input';
import { describe, expect, it, vi } from 'vitest';

import { PickerShell } from './picker_shell';

type Mod = Record<string, never>;

const configFor = (extra: Partial<InputConfig<Mod, string>> = {}): InputConfig<Mod, string> & { id: string } => ({
	id: 'cast-delay',
	label: 'Cast Delay',
	getValue: () => '',
	setValue: () => {},
	...extra,
});

const shell = (config: InputConfig<Mod, string> & { id: string }, props: { hidden?: boolean; disabled?: boolean } = {}) =>
	render(
		<PickerShell config={config} cssClass="number-picker-root" hidden={!!props.hidden} disabled={!!props.disabled}>
			<input id={config.id} />
		</PickerShell>,
	);

const root = () => document.querySelector('.input-root')!;

describe('PickerShell', () => {
	// The vanilla Input adds input-inline and extraCssClasses at construction and toggles
	// disabled/hide afterwards, so those two come last in the class list.
	it('builds the root class list in the order the vanilla Input produces', () => {
		shell(configFor({ inline: true, extraCssClasses: ['apl-picker'] }), { hidden: true, disabled: true });
		expect(root().getAttribute('class')).toBe('input-root number-picker-root input-inline apl-picker disabled hide');
	});

	it('omits the state classes when neither applies', () => {
		shell(configFor());
		expect(root().getAttribute('class')).toBe('input-root number-picker-root');
	});

	it('links the label to the input and titles it', () => {
		shell(configFor());
		const label = root().querySelector('label')!;
		expect(label.className).toBe('form-label');
		expect(label.getAttribute('for')).toBe('cast-delay');
		expect(label.getAttribute('title')).toBe('Cast Delay');
	});

	it('renders no label at all when the config has none', () => {
		shell(configFor({ label: undefined }));
		expect(root().querySelector('label')).toBeNull();
	});

	it('puts a string description in .input-description, before the input', () => {
		shell(configFor({ description: 'Delay before the first cast' }));
		expect([...root().children].map(el => el.tagName)).toEqual(['LABEL', 'DIV', 'INPUT']);
		expect(root().querySelector('.input-description')!.textContent).toBe('Delay before the first cast');
	});

	it('renders an Element description rather than stringifying it', () => {
		const description = document.createElement('span');
		description.textContent = 'Built elsewhere';
		shell(configFor({ description }));
		expect(root().querySelector('.input-description')!.firstElementChild).toBe(description);
		expect(document.body.textContent).not.toContain('[object');
	});

	it('shows a string labelTooltip on hover, anchored to the label', async () => {
		shell(configFor({ labelTooltip: 'Seconds of human reaction time' }));
		fireEvent.mouseEnter(screen.getByText('Cast Delay'));
		expect(await screen.findByText('Seconds of human reaction time')).toBeTruthy();
	});

	it('warns instead of silently dropping a tooltip it cannot render', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		shell(configFor({ labelTooltip: () => 'from a function' }));
		expect(warn).toHaveBeenCalledOnce();
		expect(root().querySelector('label')!.getAttribute('data-tooltip-id')).toBeNull();
	});

	// `classList.add` drops a repeat and clsx does not. `other_inputs.ts` ships `input-inline` in
	// `extraCssClasses` while also setting `inline`, and `rotation_tab.tsx` pushes it into the config
	// in place on every rebuild — so a duplicate would reach the DOM and the parity harness.
	it('emits a class once when a config supplies it twice', () => {
		const { container } = render(
			<PickerShell
				config={{ id: 'x', inline: true, extraCssClasses: ['input-inline', 'mb-0'], getValue: () => 0, setValue: () => {} }}
				cssClass="number-picker-root"
				hidden={false}
				disabled={false}
			/>,
		);
		const classes = Array.from(container.firstElementChild!.classList);
		expect(classes.filter(name => name === 'input-inline')).toHaveLength(1);
		expect(container.firstElementChild!.className.split(' ')).toEqual(classes);
	});
});
