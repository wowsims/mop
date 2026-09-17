import type { UIEnchant as Enchant, UIGem as Gem } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { cssVars, itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';

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
				className="flex cursor-pointer items-center border border-transparent bg-table-even -outline-offset-1 transition-[background-color,color,border] duration-150 ease-in-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-link data-active:border-success pointer-fine:hover:bg-table-row-even-hover"
				data-testid="tooltip-quick-swap__anchor"
				data-active={entry.active ? '' : undefined}
				onClick={event => {
					event.preventDefault();
					onItemClick(entry.item);
				}}>
				<img
					alt={entry.item.name}
					className="static inset-gem z-1 mr-1 inline-block size-gem-inner shrink-0 cursor-pointer rounded-none bg-cover bg-center bg-no-repeat"
					data-testid="gem-icon"
					style={cssVars({ '--gem-width': '2.5rem' })}
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
		<h3 className="mb-0 px-2 pt-2 pb-2 text-center text-(length:--h6-font-size)" data-testid="tooltip-quick-swap__title">
			{title}
		</h3>
		{entries.length ? (
			<ul className="mb-0 max-h-51.5 list-none gap-0.5 overflow-y-auto pl-0">
				{entries.map(entry => (
					<QuickSwapRow key={keyOf(entry.item)} entry={entry} onItemClick={onItemClick} />
				))}
			</ul>
		) : (
			<p className="mb-0 px-2 text-link-danger" data-testid="tooltip-quick-swap__empty">
				{emptyMessage}
			</p>
		)}
		<div className="mb-0 flex justify-center px-2 pt-2 pb-2" data-testid="tooltip-quick-swap__footer">
			<Button size="sm" onClick={footerButton.onClick}>
				{footerButton.label}
			</Button>
		</div>
	</>
);
