import type { AplNameDialogProps } from '@features/apl/components/AplNameDialog';
import type { APLRotation } from '@generated/proto/apl';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { useState } from 'react';

export interface RenamedCopyOptions<T> {
	/** The translated singular, e.g. "Group"; the dialog's title is built from it. */
	itemName: string;
	inputLabel: string;
	read: (rotation: APLRotation) => Array<T>;
	write: (rotation: APLRotation, next: Array<T>) => void;
	nameOf: (item: T) => string;
	copy: (item: T, name: string) => T;
}

export interface RenamedCopy {
	/** For the list's `onCopyItem`: it opens the dialog instead of appending a clone. */
	onCopyItem: (index: number) => void;
	dialog: AplNameDialogProps;
}

/**
 * Copying an item that is referenced **by name** — a group or a variable.
 *
 * Neither can be duplicated the way every other list duplicates a row, because two entries sharing
 * a name are two entries the rotation cannot tell apart. Both lists therefore intercept `copy`,
 * ask for the new name and insert the renamed clone next to the original.
 */
export const useRenamedCopy = <T>(player: Player<any>, { itemName, inputLabel, read, write, nameOf, copy }: RenamedCopyOptions<T>): RenamedCopy => {
	const [copying, setCopying] = useState<number | null>(null);
	// Read at render, which the dialog's own `copying` state has just triggered — so this is the
	// list as it stands the moment the dialog opens.
	const items = read(player.aplRotation);

	return {
		onCopyItem: setCopying,
		dialog: {
			open: copying !== null,
			title: i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName }),
			inputLabel,
			placeholder: copying === null ? undefined : items[copying] && nameOf(items[copying]),
			existingNames: items.map(nameOf),
			onSubmit: name =>
				player.modifyAplRotation(rotation => {
					if (copying === null) return;
					const list = read(rotation);
					const next = list.slice();
					next.splice(copying, 0, copy(list[copying], name));
					write(rotation, next);
				}),
			onClose: () => setCopying(null),
		},
	};
};
