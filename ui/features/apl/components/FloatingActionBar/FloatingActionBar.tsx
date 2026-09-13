import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { useEffect, useRef, useState } from 'react';

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
	const rootRef = useRef<HTMLDivElement>(null);
	const [stuck, setStuck] = useState(false);
	const [naming, setNaming] = useState(false);

	useEffect(() => {
		const root = rootRef.current;
		const scrollRoot = root?.parentElement;
		if (!root || !scrollRoot) return;
		// One delivery can carry several records, oldest first; the last is the current state.
		const observer = new IntersectionObserver(() => setStuck(previous => !previous), { root: scrollRoot, rootMargin: '-100% 0px 0px 0px' });
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={rootRef} className={stuck ? 'apl-floating-action-bar-root stuck' : 'apl-floating-action-bar-root'}>
			<Button variant="primary" onClick={() => (nameDialog ? setNaming(true) : onCreate())}>
				<Icon name="plus" className="me-2" />
				{newLabel}
			</Button>
			<Button variant="link" size="sm" className="btn-reset ms-auto" onClick={() => host.applyEmptyAplRotation()}>
				<Icon name="times" className="me-1" />
				{i18n.t('rotation_tab.apl.floatingActionBar.reset')}
			</Button>
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
		</div>
	);
};
