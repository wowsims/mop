import { ActionId } from '@sim/proto_utils/action_id';
import type { UIEnchant as Enchant, UIGem as Gem } from '@generated/proto/ui';
import { Button } from '@ui-kit/Button';
import { itemQualityCssClass } from '@ui-kit/css_utils';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';
import { useMemo } from 'react';

export type QuickSwapItem = Gem | Enchant;

export interface QuickSwapEntry<T extends QuickSwapItem> {
	item: T;
	active: boolean;
}

export interface QuickSwapListProps<T extends QuickSwapItem> {
	title: string;
	emptyMessage: string;
	entries: ReadonlyArray<QuickSwapEntry<T>>;
	onItemClick: (item: T) => void;
	footerButton: { label: string; onClick: () => void };
}

const QuickSwapRow = <T extends QuickSwapItem>({ entry, onItemClick }: { entry: QuickSwapEntry<T>; onItemClick: (item: T) => void }) => {
	const actionId = useMemo(() => ('spellId' in entry.item ? ActionId.fromSpellId(entry.item.spellId) : ActionId.fromItemId(entry.item.id)), [entry.item]);
	const { iconUrl, href } = useActionId(actionId);

	return (
		<li className="tooltip-quick-swap__list-item">
			<a
				href={href || undefined}
				className={clsx('tooltip-quick-swap__anchor d-flex align-items-center', entry.active && 'active')}
				onClick={event => {
					event.preventDefault();
					onItemClick(entry.item);
				}}>
				<img alt={entry.item.name} className="tooltip-quick-swap__icon gem-icon flex-shrink-0" src={iconUrl || undefined} />
				<span className={clsx('tooltip-quick-swap__label text-start', itemQualityCssClass(entry.item.quality))}>{entry.item.name}</span>
			</a>
		</li>
	);
};

const keyOf = (item: QuickSwapItem) => ('effectId' in item ? `enchant-${item.effectId}-${item.type}` : `gem-${item.id}`);

export const QuickSwapList = <T extends QuickSwapItem>({ title, emptyMessage, entries, onItemClick, footerButton }: QuickSwapListProps<T>) => (
	<>
		<h3 className="tooltip-quick-swap__title h6 text-center">{title}</h3>
		{entries.length ? (
			<ul className="tooltip-quick-swap__list">
				{entries.map(entry => (
					<QuickSwapRow key={keyOf(entry.item)} entry={entry} onItemClick={onItemClick} />
				))}
			</ul>
		) : (
			<p className="tooltip-quick-swap__empty">{emptyMessage}</p>
		)}
		<div className="tooltip-quick-swap__footer d-flex justify-content-center">
			<Button size="sm" onClick={footerButton.onClick}>
				{footerButton.label}
			</Button>
		</div>
	</>
);
