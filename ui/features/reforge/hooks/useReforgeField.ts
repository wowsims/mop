import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { ReforgeSettings } from '@sim/settings/reforge_settings';
import type { ReforgeField } from '@sim/state/sim_store';
import { subscribeReforgeField } from '@sim/state/subscriptions';
import { useMemo } from 'react';

/** One field of the reforge slice, read through its own version counter. */
export const useReforgeField = <T>(settings: ReforgeSettings, field: ReforgeField, read: () => T): T =>
	useStoreSubscribe(
		useMemo(() => subscribeReforgeField(settings, field), [settings, field]),
		read,
	);
