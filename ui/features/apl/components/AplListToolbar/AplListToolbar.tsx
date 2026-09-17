import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStickyBottom } from '@ui-kit/hooks/useStickyBottom';
import { Icon } from '@ui-kit/Icon';
import { Toolbar, ToolbarButton } from '@ui-kit/Toolbar';
import clsx from 'clsx';
import { useState } from 'react';

export interface AplListToolbarProps {
	/** Names the thing the button creates, e.g. "Action" or "Variable". */
	itemName: string;
	/**
	 * When given, the new button asks for a name first and hands it to `onCreate`. The dialog's
	 * title is the button's own label — both callers built the same string twice.
	 */
	nameDialog?: {
		inputLabel: string;
		existingNames: () => Array<string>;
	};
	onCreate: (name?: string) => void;
	className?: string;
}

/**
 * The sticky "new / reset" bar under an APL list.
 */
export const AplListToolbar = ({ itemName, nameDialog, onCreate, className }: AplListToolbarProps) => {
	const host = useSimHost();
	const newLabel = i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName });
	const { ref: rootRef, stuck } = useStickyBottom<HTMLDivElement>();
	const [naming, setNaming] = useState(false);

	return (
		<Toolbar
			ref={rootRef}
			className={clsx(
				'sticky bottom-0 mt-3 flex items-center border-0 border-border transition-[padding,border-width,background-color] duration-150 ease-in-out data-stuck:border data-stuck:bg-background data-stuck:p-2',
				className,
			)}
			testId="apl-floating-action-bar-root"
			data-stuck={stuck ? '' : undefined}>
			<ToolbarButton variant="primary" onClick={() => (nameDialog ? setNaming(true) : onCreate())}>
				<Icon name="plus" className="mr-2" />
				{newLabel}
			</ToolbarButton>
			<ToolbarButton variant="link-danger" size="sm" className="ml-auto" onClick={() => host.applyEmptyAplRotation()}>
				<Icon name="times" className="mr-1" />
				{i18n.t('rotation_tab.apl.floatingActionBar.reset')}
			</ToolbarButton>
			{nameDialog && (
				<AplNameDialog
					open={naming}
					title={newLabel}
					inputLabel={nameDialog.inputLabel}
					existingNames={naming ? nameDialog.existingNames() : []}
					onSubmit={onCreate}
					onClose={() => setNaming(false)}
				/>
			)}
		</Toolbar>
	);
};
