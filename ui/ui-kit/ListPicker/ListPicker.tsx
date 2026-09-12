import i18n from '@i18n/config';
import { translateItemLabel } from '@i18n/localization';
import { Button } from '@ui-kit/Button';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import { Tooltip } from '@ui-kit/Tooltip';
import { TooltipButton } from '@ui-kit/TooltipButton';
import clsx from 'clsx';
import { useCallback, useId, useRef } from 'react';

import type { ListDrag } from './drag_state';
import { ListItemAction } from './ListItemAction';
import { ListPickerItem } from './ListPickerItem';
import type { ListItemPickerConfig, ListPickerProps } from './types';
import { actionEnabled, canDeleteAt, moveItem } from './utils';

/**
 * A reorderable list of pickers: add, remove, copy, and drag to reorder or to move between two
 * lists of the same kind.
 *
 * It parameterises the item body (`renderItem`) and the item's header extras (`renderItemHeader`);
 * it fixes the container/header/body markup, the action buttons and the drag rules. With React
 * children the list reconciles nothing itself.
 *
 * The drag state is module-scoped in `drag_state.ts` and is **this stack's alone**; see the note
 * there for why two lists on two stacks cannot collide.
 */
export const ListPicker = <ModObject, ItemType>({ modObject, config, renderItem, renderItemHeader }: ListPickerProps<ModObject, ItemType>) => {
	const configRef = useRef(config);
	configRef.current = config;

	const listId = useId();
	const tooltipId = `${listId}-tooltip`;

	const { value, hidden, disabled } = useInput(modObject, config);

	// Read through the config, not through the snapshot: every write below is a splice against the
	// live array, and the store notification is what re-renders.
	const source = useCallback(() => configRef.current.getValue(modObject), [modObject]);
	const commit = useCallback((next: Array<ItemType>) => configRef.current.setValue(modObject, next), [modObject]);

	const horizontal = !!config.horizontalLayout;
	const inlineMenuBar = horizontal || !!config.inlineMenuBar;
	const canCreate = actionEnabled(config.allowedActions, 'create');
	const canDelete = actionEnabled(config.allowedActions, 'delete');
	const canCopy = actionEnabled(config.allowedActions, 'copy');
	const canMove = actionEnabled(config.allowedActions, 'move');

	const onCreate = () => {
		commit(source().concat([configRef.current.newItem()]));
	};

	const onDelete = (index: number) => {
		const next = source();
		next.splice(index, 1);
		commit(next);
	};

	const onCopy = (index: number) => {
		const current = configRef.current;
		if (current.onCopyItem) {
			current.onCopyItem(index);
			return;
		}
		if (!current.copyItem) return;
		const next = source().slice();
		next.splice(index, 0, current.copyItem(next[index]));
		commit(next);
	};

	const makeDrag = useCallback(
		(index: number, elem: HTMLElement): ListDrag => ({
			listId,
			itemLabel: configRef.current.itemLabel,
			dragGroup: configRef.current.dragGroup,
			index,
			elem,
			take: () => {
				const list = source();
				const [item] = list.splice(index, 1);
				commit(list);
				return item;
			},
		}),
		[listId, source, commit],
	);

	const onDrop = useCallback(
		(drag: ListDrag, dstIndex: number) => {
			// Read before the source removal — this matters: `take()` calls the other list's setValue
			// and that may notify.
			const next = source();
			if (drag.listId !== listId) {
				const item = drag.take() as ItemType;
				next.splice(dstIndex, 0, item);
				commit(next);
				return;
			}
			commit(moveItem(next, drag.index, dstIndex));
		},
		[listId, source, commit],
	);

	const itemConfig = (index: number): ListItemPickerConfig<ModObject, ItemType> => ({
		storeSubscribe: config.storeSubscribe,
		getValue: () => source()[index],
		setValue: (obj: ModObject, newValue: ItemType) => {
			const next = configRef.current.getValue(obj);
			next[index] = newValue;
			configRef.current.setValue(obj, next);
		},
	});

	const deleteTooltip = i18n.t('common.list_picker.delete_item', { itemLabel: translateItemLabel(config.itemLabel) });
	const copyTooltip = i18n.t('common.list_picker.copy_to_new', { itemLabel: translateItemLabel(config.itemLabel) });
	const newLabel = i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: config.itemLabel });

	// The two layout flags and the compact modifier were pushed into `extraClassNames` (compact) or
	// added to the root afterwards (the other two); the shell owns the root's whole class list, so
	// they arrive here instead. SERIALIZE sorts class lists, so only the set has to match.
	const extraClassNames = [
		...(config.extraClassNames || []),
		...(config.isCompact ? ['list-picker-compact'] : []),
		...(config.hideUi ? ['d-none'] : []),
		...(horizontal ? ['horizontal'] : []),
	];

	return (
		<PickerShell config={{ ...config, extraClassNames, id: config.id ?? listId }} className="list-picker-root" hidden={hidden} disabled={disabled}>
			{config.title !== undefined && (
				// A `<label>` naming no control is not a label — the standing rule for this tree.
				<span className="list-picker-title form-label">
					{config.title}
					{config.titleTooltip && <TooltipButton tooltip={config.titleTooltip} className="ms-2" />}
				</span>
			)}
			{value.length > 0 && (
				<div className="list-picker-items">
					{value.map((_item, index) => (
						<ListPickerItem
							key={index}
							index={index}
							listId={listId}
							itemLabel={config.itemLabel}
							inlineMenuBar={inlineMenuBar}
							title={!inlineMenuBar && config.itemLabel ? `${config.itemLabel} ${index + 1}` : undefined}
							dragGroup={config.dragGroup}
							sameGroupOnly={config.sameGroupOnly}
							canDelete={canDelete && canDeleteAt(index, config.minimumItems)}
							canCopy={canCopy}
							canMove={canMove}
							extraActions={config.extraActions}
							deleteTooltip={deleteTooltip}
							copyTooltip={copyTooltip}
							tooltipId={tooltipId}
							onDelete={onDelete}
							onCopy={onCopy}
							makeDrag={makeDrag}
							onDrop={onDrop}
							header={renderItemHeader?.(index)}>
							{renderItem(index, itemConfig(index))}
						</ListPickerItem>
					))}
				</div>
			)}
			{canCreate &&
				(config.actions?.create?.useIcon ? (
					<ListItemAction
						icon="fa-plus"
						className={['link-success', 'list-picker-new-button']}
						tooltip={newLabel}
						tooltipId={tooltipId}
						onClick={onCreate}
					/>
				) : (
					<Button variant="primary" className="list-picker-new-button" onClick={onCreate}>
						<i className="fa fa-plus me-2" />
						{newLabel}
					</Button>
				))}
			<Tooltip id={tooltipId} />
		</PickerShell>
	);
};
