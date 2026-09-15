import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { ReforgeSettings } from '@sim/settings/reforge_settings';
import type { ReforgeField } from '@sim/state/sim_store';
import { subscribeReforgeField } from '@sim/state/subscriptions';

/** One field of the reforge slice, read through its own version counter. */
export const useReforgeField = <T>(settings: ReforgeSettings, field: ReforgeField, read: () => T): T =>
	useStoreSubscribe(subscribeReforgeField(settings, field), read);
