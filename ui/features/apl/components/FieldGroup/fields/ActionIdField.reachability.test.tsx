import { actionKinds } from '@features/apl/model/action_kinds';
import type { APLFieldDescriptor } from '@features/apl/model/field_descriptors';
import { resolveField } from '@features/apl/model/field_specs';
import { valueKinds } from '@features/apl/model/value_kinds';
import { makePlayer } from '@features/apl/testing';
import { APLRotation, APLValue } from '@generated/proto/apl';
import { ActionID, UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValuePicker } from '../../ValuePicker';
import { ActionIdField } from './ActionIdField';

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

const TARGET_REF = UnitReference.create({ type: UnitType.Target, index: 3 });
const PLAYER_REF = UnitReference.create({ type: UnitType.Player, index: 1 });

let player: ReturnType<typeof makePlayer>;
let parentValue: Record<string, any>;
let reads: Array<string>;

const describeRef = (ref: UnitReference | undefined) => (ref ? `${UnitType[ref.type]}:${ref.index}` : 'none');

const setup = () => {
	source.listeners.clear();
	reads = [];
	parentValue = { sourceUnit: TARGET_REF, otherUnit: PLAYER_REF, auraId: ActionID.create() };
	player = makePlayer(APLRotation.create(), () => source.notify());
	const metadata = { getSpells: () => [], getAuras: () => [], getName: () => '' };
	player.sim.getUnitMetadata = (ref: UnitReference | undefined) => {
		reads.push(describeRef(ref));
		return metadata;
	};
};

const fieldConfig = () => ({
	id: 'aura',
	storeSubscribe: () => source.subscribe,
	getValue: () => parentValue.auraId,
	setValue: () => {},
});

const Field = ({ unitRefField }: { unitRefField: string }) => (
	<ActionIdField
		player={player as never}
		config={fieldConfig() as never}
		actionIdSet="auras"
		unitRefField={unitRefField}
		defaultUnitRef="self"
		getParentValue={() => parentValue}
	/>
);

let chosenField = 'sourceUnit';

const Harness = () => {
	const unitRefField = useSyncExternalStore(source.subscribe, () => chosenField);
	return (
		<SimHostProvider host={{ player, rootElem: document.body } as never}>
			<Field unitRefField={unitRefField} />
		</SimHostProvider>
	);
};

const valueConfig = () => ({
	getValue: () => player.aplRotation.valueVariables[0].value,
	setValue: (_subject: unknown, next: APLValue | undefined) => {
		player.aplRotation.valueVariables[0].value = next;
		source.notify();
	},
});

const builderRoots = () => Array.from(document.querySelectorAll('[data-testid="apl-picker-builder-root"]'));

const actionIdDescriptors = (fields: Array<APLFieldDescriptor>) => fields.filter(field => field.type === 'actionId');

const specUnitRefField = (descriptor: APLFieldDescriptor) => {
	const spec = resolveField(descriptor);
	return spec.kind === 'actionId' ? spec.unitRefField : 'not an actionId field';
};

beforeEach(() => {
	document.body.innerHTML = '';
	chosenField = 'sourceUnit';
});

describe('ActionIdField — the cached read, if the prop could ever move', () => {
	it('reads the unit named by unitRefField on mount', () => {
		setup();
		render(<Harness />);

		expect(new Set(reads)).toEqual(new Set(['Target:3']));
	});

	it('keeps reading the old unitRefField for one notification after the prop changes, because the notification re-reads before the render that brings the new prop', () => {
		setup();
		render(<Harness />);
		reads.length = 0;

		act(() => {
			chosenField = 'otherUnit';
			source.notify();
		});
		expect(reads).toEqual(['Target:3']);

		act(() => source.notify());
		expect(reads).toEqual(['Target:3', 'Player:1']);
	});

	it('performs no read at all when the prop changes without a notification', () => {
		setup();
		const view = render(<Harness />);
		reads.length = 0;

		act(() => {
			chosenField = 'otherUnit';
			view.rerender(<Harness />);
		});

		expect(reads).toEqual([]);
	});
});

describe('ActionIdField — but no user action can move that prop', () => {
	it('takes unitRefField straight from the kind table, with no runtime input', () => {
		const descriptors = [...Object.values(valueKinds), ...Object.values(actionKinds)].flatMap(kind => actionIdDescriptors(kind.fields));

		expect(descriptors.length).toBeGreaterThan(40);
		descriptors.forEach(descriptor => {
			expect(specUnitRefField(descriptor)).toBe(descriptor.unitRefField);
		});
	});

	it('hands every kind the same fields array on every read, so a mounted field group can never resolve a second spec', () => {
		Object.entries(valueKinds).forEach(([name, kind]) => {
			expect(kind.fields, name).toBe(valueKinds[name as keyof typeof valueKinds].fields);
		});
		Object.entries(actionKinds).forEach(([name, kind]) => {
			expect(kind.fields, name).toBe(actionKinds[name as keyof typeof actionKinds].fields);
		});
	});

	it('names two different unitRefFields at the same field index across kinds, which is the only way the prop could move', () => {
		expect(actionIdDescriptors(valueKinds.auraIsKnown.fields)[0].unitRefField).toBe('sourceUnit');
		expect(actionIdDescriptors(valueKinds.dotIsActive.fields)[0].unitRefField).toBe('');
		expect(valueKinds.auraIsKnown.fields.indexOf(actionIdDescriptors(valueKinds.auraIsKnown.fields)[0])).toBe(1);
		expect(valueKinds.dotIsActive.fields.indexOf(actionIdDescriptors(valueKinds.dotIsActive.fields)[0])).toBe(1);
	});

	it('replaces the whole field group when the kind changes, so the mounted ActionIdField is unmounted before the second spec exists', () => {
		setup();
		player.aplRotation = APLRotation.create({
			valueVariables: [{ name: 'root', value: APLValue.create({ value: { oneofKind: 'auraIsKnown', auraIsKnown: {} }, uuid: { value: 'u' } }) }],
		});
		render(
			<SimHostProvider host={{ player, rootElem: document.body } as never}>
				<ValuePicker player={player as never} config={valueConfig() as never} />
			</SimHostProvider>,
		);
		const before = builderRoots()[0];
		expect(before).toBeTruthy();

		act(() => {
			player.aplRotation.valueVariables[0].value!.value = { oneofKind: 'dotIsActive', dotIsActive: {} } as never;
			source.notify();
		});

		expect(builderRoots()[0]).toBeTruthy();
		expect(builderRoots()[0]).not.toBe(before);
		expect(before.isConnected).toBe(false);
	});
});
