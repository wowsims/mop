import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRenamedCopy } from './useRenamedCopy';

vi.mock('@i18n/config', () => ({ default: { t: (key: string, values?: Record<string, string>) => `${key}:${values?.itemName ?? ''}` } }));

const rotationWith = (names: Array<string>) => APLRotation.create({ groups: names.map(name => ({ name, actions: [], variables: [] })) });

const mount = (rotation: APLRotation) => {
	const player = makePlayer(rotation, () => {});
	let latest!: ReturnType<typeof useRenamedCopy>;
	const Probe = () => {
		latest = useRenamedCopy(player as never, {
			itemName: 'Group',
			inputLabel: 'name',
			read: current => current.groups || [],
			write: (current, next) => {
				current.groups = next;
			},
			nameOf: group => group.name,
			copy: (group, name) => ({ ...group, name }),
		});
		return null;
	};
	render(<Probe />);
	return { player, hook: () => latest };
};

describe('useRenamedCopy', () => {
	it('keeps the dialog closed until a row asks to be copied', () => {
		const { hook } = mount(rotationWith(['a', 'b']));

		expect(hook().dialog.open).toBe(false);
		act(() => hook().onCopyItem(1));
		expect(hook().dialog.open).toBe(true);
	});

	it('offers the copied row’s name as the placeholder and every name as taken', () => {
		const { hook } = mount(rotationWith(['a', 'b']));

		act(() => hook().onCopyItem(1));
		expect(hook().dialog.placeholder).toBe('b');
		expect(hook().dialog.existingNames).toEqual(['a', 'b']);
	});

	it('inserts the renamed copy beside the original rather than appending it', () => {
		const { player, hook } = mount(rotationWith(['a', 'b', 'c']));

		act(() => hook().onCopyItem(1));
		act(() => hook().dialog.onSubmit('b copy'));

		expect(player.aplRotation.groups!.map(group => group.name)).toEqual(['a', 'b copy', 'b', 'c']);
	});

	it('writes nothing once the dialog has been dismissed', () => {
		const { player, hook } = mount(rotationWith(['a']));

		act(() => hook().onCopyItem(0));
		act(() => hook().dialog.onClose());
		act(() => hook().dialog.onSubmit('late'));

		expect(player.aplRotation.groups!.map(group => group.name)).toEqual(['a']);
	});
});
