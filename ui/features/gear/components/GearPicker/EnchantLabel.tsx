import type { UIEnchant as Enchant } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { getEnchantDescription } from '@sim/proto/enchants';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';
import { useEffect, useMemo, useState } from 'react';

import { ItemCellAnchor } from '../ItemCell';

export interface EnchantLabelProps {
	className: string;
	testId?: string;
	enchant?: Enchant | null;
	onActivate?: () => void;
	tooltipId?: string;
}

export const EnchantLabel = ({ className, testId, enchant, onActivate, tooltipId }: EnchantLabelProps) => {
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

	const wowheadProps = useActionIdWowheadDataset(actionId);

	const href = actionId ? (actionId.spellId ? ActionId.makeSpellUrl(actionId.spellId) : ActionId.makeItemUrl(actionId.itemId)) : undefined;

	if (!enchant) return null;

	return (
		<ItemCellAnchor
			className={className}
			data-testid={testId}
			role="button"
			href={href}
			onActivate={onActivate}
			data-whtticon="false"
			data-tooltip-id={tooltipId}
			{...wowheadProps}>
			{description}
		</ItemCellAnchor>
	);
};
