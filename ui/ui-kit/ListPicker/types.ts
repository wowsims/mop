import type { InputConfig } from '@ui-kit/input';
// Type-only, so nothing of the vanilla list's runtime (tippy, i18n, the module drag global) is
// pulled in: these three shapes are its API and restating them is how the two would drift.
import type { ListItemAction, ListPickerActionsConfig, ListPickerExtraAction } from '@ui-kit/pickers/list_picker';
import type { ReactNode } from 'react';

export type { ListItemAction, ListPickerActionsConfig, ListPickerExtraAction };

type CopyItemConfig<ItemType> = { copyItem: (oldItem: ItemType) => ItemType; onCopyItem?: never } | { copyItem?: never; onCopyItem: (index: number) => void };

/** The per-item binding the list hands its `renderItem`: vanilla's `ListItemPickerConfig`. */
export interface ListItemPickerConfig<ModObject, ItemType> extends InputConfig<ModObject, ItemType> {}

export type ListPickerConfig<ModObject, ItemType> = Omit<InputConfig<ModObject, Array<ItemType>>, 'id'> &
	CopyItemConfig<ItemType> & {
		id?: string;
		itemLabel: string;
		newItem: () => ItemType;
		actions?: ListPickerActionsConfig;
		title?: string;
		titleTooltip?: string;
		inlineMenuBar?: boolean;
		hideUi?: boolean;
		horizontalLayout?: boolean;
		/** Removes the border and padding of the list items. */
		isCompact?: boolean;
		/** Disables the delete button while the list is at the minimum. */
		minimumItems?: number;
		/** When set, only these actions are allowed; otherwise all of them are. */
		allowedActions?: Array<ListItemAction>;
		dragGroup?: string;
		/**
		 * Only accept a drag from another list when both name the same `dragGroup`.
		 *
		 * Vanilla spelled this `this.config.itemLabel !== 'Action'` — a comparison against an English
		 * literal, while the two lists it governs label themselves with `i18n.t(…)`. Under any other
		 * locale the test never matched and the restriction silently disappeared, so it is a named
		 * flag here and the rule now holds in every locale.
		 */
		sameGroupOnly?: boolean;
		/** Extra buttons in the per-item popover menu. */
		extraActions?: Array<ListPickerExtraAction>;
	};

export interface ListPickerProps<ModObject, ItemType> {
	modObject: ModObject;
	config: ListPickerConfig<ModObject, ItemType>;
	/** The item's body. A render prop: the node is placed by the list, not rendered by the caller. */
	renderItem: (index: number, itemConfig: ListItemPickerConfig<ModObject, ItemType>) => ReactNode;
	/**
	 * Extra content for the item's header row, beside the actions button. This is what replaces
	 * `ListPicker.getItemHeaderElem` — vanilla's consumers reached the header by walking to the
	 * item's sibling element and asserting on its class.
	 */
	renderItemHeader?: (index: number) => ReactNode;
}
