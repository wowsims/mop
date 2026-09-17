import { Autocomplete } from '@base-ui/react/autocomplete';
import { FieldShell } from '@ui-kit/FieldShell';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import clsx from 'clsx';
import { type Key, type ReactNode, type RefObject } from 'react';

export interface ComboBoxProps<T> {
	value: string;
	onChange: (value: string) => void;
	items: readonly T[];
	itemKey: (item: T) => Key;
	renderItem: (item: T, index: number) => ReactNode;
	onItemSelect: (item: T) => void;
	open: boolean;
	onOpenChange: (open: boolean, reason: string) => void;
	closeOnSelect?: boolean;
	multiColumn?: boolean;
	popupAnchor?: RefObject<HTMLElement | null>;
	footer?: ReactNode;
	placeholder?: string;
	label?: string;
	id?: string;
	clearable?: boolean;
	clearLabel?: string;
	clearClassName?: string;
	className?: string;
	grow?: boolean;
	autoComplete?: 'on' | 'off';
	inputTestId?: string;
	listTestId?: string;
	listClassName?: string;
}

export const ComboBox = <T,>({
	value,
	onChange,
	items,
	itemKey,
	renderItem,
	onItemSelect,
	open,
	onOpenChange,
	closeOnSelect = false,
	multiColumn = false,
	popupAnchor,
	footer,
	placeholder,
	label,
	id,
	clearable = false,
	clearLabel,
	clearClassName,
	className,
	grow = true,
	autoComplete,
	inputTestId,
	listTestId,
	listClassName,
}: ComboBoxProps<T>) => {
	const portalContainer = usePortalContainer();

	return (
		<Autocomplete.Root
			mode="none"
			items={items}
			value={value}
			onValueChange={(next, details) => {
				if (details.reason === 'item-press') return;
				onChange(next);
			}}
			open={open}
			onOpenChange={(next, details) => {
				if (!closeOnSelect && details.reason === 'item-press') return;
				onOpenChange(next, details.reason);
			}}
			openOnInputClick={false}>
			<FieldShell
				label={label}
				id={id}
				grow={grow}
				rootTestId="combo-box-root"
				showClear={clearable && value.length > 0}
				clearLabel={clearLabel}
				clearClassName={clearClassName}
				clearTestId="combo-box-clear-btn"
				onClear={() => onChange('')}>
				<Autocomplete.Input
					id={id}
					data-testid={inputTestId}
					className={clsx('ui-input', className)}
					placeholder={placeholder}
					autoComplete={autoComplete}
				/>
			</FieldShell>
			<Autocomplete.Portal className="contents" container={portalContainer ?? undefined}>
				<Autocomplete.Positioner className="ui-combo-box-positioner" align="start" sideOffset={2} anchor={popupAnchor}>
					<Autocomplete.Popup className="ui-combo-box-popup">
						<Autocomplete.List
							className={clsx('ui-combo-box-list', listClassName)}
							data-testid={listTestId}
							data-multi-column={multiColumn ? '' : undefined}
							render={<ul />}>
							{items.map((item, index) => (
								<Autocomplete.Item
									key={itemKey(item)}
									value={item}
									index={index}
									className="ui-combo-box-item"
									render={<li />}
									onClick={() => onItemSelect(item)}>
									{renderItem(item, index)}
								</Autocomplete.Item>
							))}
						</Autocomplete.List>
						{footer}
					</Autocomplete.Popup>
				</Autocomplete.Positioner>
			</Autocomplete.Portal>
		</Autocomplete.Root>
	);
};
