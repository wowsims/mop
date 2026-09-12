import { ActionId } from '@sim/proto/action_id';
import { getEnchantDescription } from '@sim/proto/enchants';
import type { UIEnchant as Enchant } from '@generated/proto/ui';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ItemCellAnchor } from '../ItemCell';

export interface EnchantLabelProps {
	className: string;
	enchant?: Enchant | null;
	onActivate?: () => void;
	tooltipId?: string;
}

export const EnchantLabel = ({ className, enchant, onActivate, tooltipId }: EnchantLabelProps) => {
	const anchorRef = useRef<HTMLAnchorElement>(null);
	const [description, setDescription] = useState('');

	const actionId = useMemo(
		() => (enchant ? (enchant.spellId ? ActionId.fromSpellId(enchant.spellId) : ActionId.fromItemId(enchant.itemId)) : undefined),
		[enchant],
	);

	useEffect(() => {
		if (!enchant) {
			setDescription('');
			return;
		}
		let live = true;
		getEnchantDescription(enchant)
			.then(text => {
				if (live) setDescription(text);
			})
			.catch(() => {
				if (live) setDescription(enchant.name);
			});
		return () => {
			live = false;
		};
	}, [enchant]);

	useActionIdWowheadDataset(anchorRef, actionId);

	const href = actionId ? (actionId.spellId ? ActionId.makeSpellUrl(actionId.spellId) : ActionId.makeItemUrl(actionId.itemId)) : undefined;

	if (!enchant) return null;

	return (
		<ItemCellAnchor
			ref={anchorRef}
			className={className}
			role="button"
			href={href}
			onActivate={onActivate}
			data-whtticon="false"
			data-tooltip-id={tooltipId}>
			{description}
		</ItemCellAnchor>
	);
};
