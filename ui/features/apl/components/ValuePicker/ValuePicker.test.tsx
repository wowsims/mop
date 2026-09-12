import { makePlayer } from '@features/apl/testing';
import { APLRotation, APLValue } from '@generated/proto/apl';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValuePicker } from './ValuePicker';

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

// Statically imported for every test that is not about the cycle. The two that are reset the
// module registry and import again, and their `await import(…)` re-evaluates the whole graph —
// `value_kinds.ts` and `action_kinds.ts` included, which is why they carry their own timeout.
const constValue = (val: string) => APLValue.create({ value: { oneofKind: 'const', const: { val } }, uuid: { value: 'u-const' } });

/** `not(const)` — one value wrapping another, which is the smallest thing that needs the cycle. */
const notValue = () => APLValue.create({ value: { oneofKind: 'not', not: { val: constValue('5') } }, uuid: { value: 'u-not' } });

let rotation: APLRotation;
let player: ReturnType<typeof makePlayer>;

const setup = (value: APLValue | undefined) => {
	source.listeners.clear();
	rotation = APLRotation.create({ valueVariables: [{ name: 'root', value }] });
	player = makePlayer(rotation, () => source.notify());
};

const configForRoot = () => ({
	getValue: () => player.aplRotation.valueVariables[0].value,
	setValue: (_subject: unknown, next: APLValue | undefined) => {
		player.aplRotation.valueVariables[0].value = next;
		source.notify();
	},
});

const roots = () => Array.from(document.querySelectorAll('.apl-value-picker-root'));
const kindTriggers = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.apl-value-picker-root > .dropdown-picker-root .dropdown-picker-button'));

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('ValuePicker', () => {
	it('renders the kind picker and the kind’s fields, in that order', () => {
		setup(constValue('5'));
		render(<ValuePicker player={player as never} config={configForRoot() as never} />);

		const root = roots()[0];
		expect(root.children[0].className).toContain('dropdown-picker-root');
		expect(root.children[1].className).toContain('apl-picker-builder-root');
		expect(root.querySelector('.adaptive-string-picker-root input')).toHaveProperty('value', '5');
	});

	it('renders no field group while the value has no kind', () => {
		setup(undefined);
		render(<ValuePicker player={player as never} config={configForRoot() as never} />);

		expect(roots()).toHaveLength(1);
		expect(document.querySelector('.apl-picker-builder-root')).toBeNull();
	});

	// The cycle: ValuePicker -> FieldGroup -> AplField -> ValuePicker. It is a real ES module cycle,
	// and it only holds because AplField dispatches inside its body. Importing ValuePicker as the
	// FIRST module of the cycle after a registry reset is what makes that observable: with a
	// module-level component table in AplField this throws
	// "Cannot access 'ValuePicker' before initialization" instead of rendering.
	it('resolves the value -> field -> value cycle when ValuePicker is imported cold, first', async () => {
		vi.resetModules();
		setup(notValue());
		const cold = await import('./ValuePicker');
		render(<cold.ValuePicker player={player as never} config={configForRoot() as never} />);

		// Two levels: the `not`, and the `const` it holds.
		expect(roots()).toHaveLength(2);
		expect(roots()[1].closest('.apl-picker-builder-root')).toBe(roots()[0].querySelector('.apl-picker-builder-root'));
	}, 30000);

	it('resolves the same cycle when AplField is imported cold, first', async () => {
		vi.resetModules();
		setup(notValue());
		await import('../FieldGroup/AplField');
		const cold = await import('./ValuePicker');
		render(<cold.ValuePicker player={player as never} config={configForRoot() as never} />);

		expect(roots()).toHaveLength(2);
	}, 30000);

	it('mints a uuid for a value that arrived without one', () => {
		setup(APLValue.create({ value: { oneofKind: 'const', const: { val: '1' } } }));
		render(<ValuePicker player={player as never} config={configForRoot() as never} />);

		expect(player.aplRotation.valueVariables[0].value!.uuid!.value).toMatch(/.+/);
	});

	it('re-reads the value when the rotation notifies', () => {
		setup(constValue('5'));
		render(<ValuePicker player={player as never} config={configForRoot() as never} />);

		act(() => {
			(player.aplRotation.valueVariables[0].value!.value as any).const.val = '9';
			source.notify();
		});
		expect(document.querySelector('.adaptive-string-picker-root input')).toHaveProperty('value', '9');
	});

	it('shows the new kind’s operands when a value is replaced by another kind with the same fields', () => {
		const list = (kind: 'and' | 'or', vals: Array<string>) =>
			APLValue.create({ value: { oneofKind: kind, [kind]: { vals: vals.map(constValue) } } as APLValue['value'], uuid: { value: `u-${kind}` } });
		const operands = () => Array.from(document.querySelectorAll<HTMLInputElement>('.adaptive-string-picker-root input')).map(input => input.value);
		setup(list('and', ['1', '2']));
		render(
			<SimHostProvider host={{ player, rootElem: document.body } as never}>
				<ValuePicker player={player as never} config={configForRoot() as never} />
			</SimHostProvider>,
		);
		expect(operands()).toEqual(['1', '2']);

		act(() => {
			player.aplRotation.valueVariables[0].value = list('or', ['3']);
			source.notify();
		});
		expect(operands()).toEqual(['3']);
	});

	// The kind list leads with an explicit "none" entry whose value is `undefined`, so an empty
	// value *matches an option* and the trigger shows that option's label rather than the picker's
	// `defaultLabel`.
	it('shows the "none" option, not the default label, for a value with no kind', () => {
		setup(undefined);
		render(<ValuePicker player={player as never} config={configForRoot() as never} />);

		expect(kindTriggers()[0].textContent).toBe('rotation_tab.apl.values.none');
	});
});
