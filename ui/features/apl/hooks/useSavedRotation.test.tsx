import { APLRotation } from '@generated/proto/apl';
import { SavedRotation } from '@generated/proto/ui';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSavedRotation } from './useSavedRotation';

const STORAGE_KEY = 'warrior-fury__savedRotation';

// `uuid` lives on APLValue, which is where a rotation written before cce07201c still carries them.
const withUuids = SavedRotation.create({
	rotation: APLRotation.create({
		priorityList: [
			{
				hide: false,
				action: {
					condition: { uuid: { value: 'minted-by-an-older-build' }, value: { oneofKind: 'const', const: { val: '1s' } } },
					action: { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'opener' } },
				},
			},
		],
	}),
});

const Probe = () => {
	const { entries } = useSavedRotation();
	return <span data-testid="json">{entries[0]?.json ?? ''}</span>;
};

const mount = () => {
	const host = { getSavedRotationStorageKey: () => STORAGE_KEY } as never;
	return render(
		<SimHostProvider host={host}>
			<Probe />
		</SimHostProvider>,
	);
};

describe('useSavedRotation', () => {
	beforeEach(() => window.localStorage.clear());

	it('strips the uuids a stored rotation carries, so it can compare equal to the live one', () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Cleave: SavedRotation.toJson(withUuids) }));

		const { getByTestId } = mount();

		expect(getByTestId('json').textContent).not.toContain('uuid');
		expect(getByTestId('json').textContent).not.toContain('minted-by-an-older-build');
	});
});
