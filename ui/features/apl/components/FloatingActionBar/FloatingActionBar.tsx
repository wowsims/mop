import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStickyBottom } from '@ui-kit/hooks/useStickyBottom';
import { Icon } from '@ui-kit/Icon';
import { Toolbar, ToolbarButton } from '@ui-kit/Toolbar';
import { useState } from 'react';

export interface FloatingActionBarProps {
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
}

/**
 * The sticky "new / reset" bar under an APL list.
 *
 * `stuck` is **toggled** on each observer delivery rather than set from `isIntersecting`: with the
 * `-100%` top margin the element crosses the boundary once per direction, so the toggle tracks it —
 * but it is state derived by parity of events rather than from the event, and it is worth replacing
 * the day the class is given a second reader.
 */
export const FloatingActionBar = ({ itemName, nameDialog, onCreate }: FloatingActionBarProps) => {
	const host = useSimHost();
	const newLabel = i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName });
	const { ref: rootRef, stuck } = useStickyBottom<HTMLDivElement>();
	const [naming, setNaming] = useState(false);

	return (
		<Toolbar
			ref={rootRef}
			className="sticky bottom-0 flex items-center mt-3 border-0 border-border transition-[padding,border-width,background-color] duration-150 ease-in-out data-stuck:border data-stuck:bg-background data-stuck:p-2"
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
