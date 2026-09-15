import type { ActionID as ActionIdProto } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { ActionId } from '@sim/proto/action_id';
import { Button } from '@ui-kit/Button';
import { FieldLabel } from '@ui-kit/FormControl';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { NumberListPicker } from '@ui-kit/NumberListPicker';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useMemo } from 'react';

import { actionPickerConfig, deleteCooldown, timingsPickerConfig } from './utils';

export interface CooldownRowProps {
	index: number;
	id: ActionIdProto | undefined;
	available: ReadonlyArray<ActionId>;
	/** The trailing row, which picks a cooldown that does not exist yet. */
	isAdd: boolean;
	deleteTooltipId: string;
}

export const CooldownRow = ({ index, id, available, isAdd, deleteTooltipId }: CooldownRowProps) => {
	const player = usePlayer();
	const actionConfig = useMemo(() => actionPickerConfig(available, index), [available, index]);
	const timingsConfig = useMemo(() => timingsPickerConfig(index, isAdd), [index, isAdd]);
	const actionId = id ? ActionId.fromProto(id) : undefined;
	const { name } = useActionId(actionId);

	return (
		<div className="mb-3 flex items-center justify-between [&>*:not(:last-child)]:mr-2" data-testid="cooldown-picker" data-add={isAdd ? '' : undefined}>
			<IconEnumPicker modObject={player} config={actionConfig} />
			<FieldLabel as="span" className="min-w-[30%] overflow-hidden text-ellipsis" testId="cooldown-picker-label">
				{name}
			</FieldLabel>
			<NumberListPicker modObject={player} config={timingsConfig} />
			<Button
				variant="unstyled"
				aria-label={i18n.t('rotation_tab.cooldowns.delete_tooltip')}
				className={clsx('text-link-danger', isAdd && 'invisible')}
				data-testid="delete-cooldown"
				onClick={() => deleteCooldown(player, index)}
				{...tooltipAnchorProps(deleteTooltipId)}>
				<Icon name="times" style="base" size="xl" />
			</Button>
		</div>
	);
};
