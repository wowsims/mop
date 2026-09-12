import type { ActionId } from '@sim/proto/action_id';
import { actionIdWowheadTooltipData } from '@sim/proto/action_id/dom';
import { useMemo } from 'react';

import { useWowheadDataset } from './useWowheadDataset';

export const useActionIdWowheadDataset = (actionId: ActionId | null | undefined, useBuffAura?: boolean) => {
	const resolve = useMemo(() => (actionId ? () => actionIdWowheadTooltipData(actionId, { useBuffAura }) : null), [actionId, useBuffAura]);
	return useWowheadDataset(resolve);
};
