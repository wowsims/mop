import { booleanFieldConfig, numberFieldConfig, stringFieldConfig, valueListFieldConfig } from '@features/apl/model/field_descriptors';
import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FieldGroup } from './FieldGroup';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => Array.from(listeners).forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(source.subscribe));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

let impl: Record<string, any>;
let player: ReturnType<typeof makePlayer>;

const setup = (initial: Record<string, any> = {}) => {
	source.listeners.clear();
	impl = initial;
	player = makePlayer(APLRotation.create(), () => source.notify());
};

const config = () => ({ getValue: () => impl, setValue: () => {} });

const mount = (fields: Array<any>) =>
	render(
		<SimHostProvider host={{ player, rootElem: document.body } as never}>
			<FieldGroup player={player as never} config={config() as never} fields={fields} />
		</SimHostProvider>,
	);

const root = () => document.querySelector('[data-testid="apl-picker-builder-root"]') as HTMLElement;
const stringInput = () => root().querySelector('[data-testid="adaptive-string-picker-root"] input') as HTMLInputElement;

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('FieldGroup', () => {
	it('renders the fields in table order, inside one apl-picker-builder-root', () => {
		setup({ text: 'a', flag: true, count: 3 });
		mount([stringFieldConfig('text'), booleanFieldConfig('flag', 'Flag'), numberFieldConfig('count', false)]);

		expect(root().hasAttribute('data-input-root')).toBe(true);
		expect(
			[...root().children].map(
				(child, index) => child.getAttribute('data-testid') === ['adaptive-string-picker-root', 'boolean-picker-root', 'number-picker-root'][index],
			),
		).toEqual([true, true, true]);
	});

	// `getValue` writes: an unset proto field is filled in with the spec's default before it is read
	// back, which is what makes a freshly picked kind show anything at all.
	it('fills an unset field with the spec default on the first read', () => {
		setup({});
		mount([numberFieldConfig('count', false)]);

		expect(impl.count).toBe(0);
	});

	it('writes the field and touches the rotation on a change', () => {
		setup({ text: 'a' });
		const touched = vi.spyOn(player, 'touchRotation');
		mount([stringFieldConfig('text')]);

		fireEvent.change(stringInput(), { target: { value: 'b' } });
		expect(impl.text).toBe('b');
		expect(touched).toHaveBeenCalled();
	});

	// `useStoreSubscribe` only re-reads `getValue` when its source notifies, so a field config
	// without a `storeSubscribe` renders once and then never again — silently.
	it('re-reads a field when the rotation notifies', () => {
		setup({ text: 'a' });
		mount([stringFieldConfig('text')]);

		act(() => {
			impl.text = 'z';
			source.notify();
		});
		expect(stringInput().value).toBe('z');
	});

	it('lays the three leaf pickers out inline', () => {
		setup({ text: 'a', flag: true, count: 3 });
		mount([stringFieldConfig('text'), booleanFieldConfig('flag', 'Flag'), numberFieldConfig('count', false)]);

		expect([...root().children].map(child => child.getAttribute('data-layout'))).toEqual(['inline', 'inline', 'inline']);
	});

	it('marks a list field ui-apl-picker-builder-multi', () => {
		setup({ vals: [] });
		mount([valueListFieldConfig('vals')]);

		expect(root().querySelector('[data-testid="list-picker-root"]')!.className.split(' ')).toContain('ui-apl-picker-builder-multi');
	});
});
