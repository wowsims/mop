import type { UIEnchant as Enchant, UIGem as Gem } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';
import type { CSSProperties } from 'react';

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
	const actionId = 'spellId' in entry.item ? ActionId.fromSpellId(entry.item.spellId) : ActionId.fromItemId(entry.item.id);
	const { iconUrl, href } = useActionId(actionId);

	return (
		<li className="not-last:border-b not-last:border-b-border odd:[&_a]:bg-table-odd">
			<a
				href={href || undefined}
				className={clsx(
					'flex items-center cursor-pointer bg-table-even border border-transparent',
					'transition-[background-color,color,border] duration-150 ease-in-out',
					'pointer-fine:hover:bg-table-row-even-hover',
					'data-active:border-success focus-visible:outline focus-visible:outline-1 focus-visible:outline-link -outline-offset-1',
				)}
				data-testid="tooltip-quick-swap__anchor"
				data-active={entry.active ? '' : undefined}
				onClick={event => {
					event.preventDefault();
					onItemClick(entry.item);
				}}>
				<img
					alt={entry.item.name}
					className="shrink-0 static mr-1 rounded-none inline-block size-gem-inner inset-gem z-1 bg-no-repeat bg-cover bg-center cursor-pointer"
					data-testid="gem-icon"
					style={{ '--gem-width': '2.5rem' } as CSSProperties}
					src={iconUrl || undefined}
				/>
				<span className={clsx('truncate text-left', itemQualityClassName(entry.item.quality))} data-testid="tooltip-quick-swap__label">
					{entry.item.name}
				</span>
			</a>
		</li>
	);
};

const keyOf = (item: QuickSwapItem) => ('effectId' in item ? `enchant-${item.effectId}-${item.type}` : `gem-${item.id}`);

export const QuickSwapList = <T extends QuickSwapItem>({ title, emptyMessage, entries, onItemClick, footerButton }: QuickSwapListProps<T>) => (
	<>
		<h3 className="text-(length:--h6-font-size) text-center px-2 pt-2 pb-2 mb-0" data-testid="tooltip-quick-swap__title">
			{title}
		</h3>
		{entries.length ? (
			<ul className="max-h-51.5 overflow-y-auto pl-0 list-none mb-0 gap-0.5">
				{entries.map(entry => (
					<QuickSwapRow key={keyOf(entry.item)} entry={entry} onItemClick={onItemClick} />
				))}
			</ul>
		) : (
			<p className="px-2 mb-0 text-link-danger" data-testid="tooltip-quick-swap__empty">
				{emptyMessage}
			</p>
		)}
		<div className="flex justify-center px-2 pt-2 pb-2 mb-0" data-testid="tooltip-quick-swap__footer">
			<Button size="sm" onClick={footerButton.onClick}>
				{footerButton.label}
			</Button>
		</div>
	</>
);
