import type { UnitReference } from '@generated/proto/common';
import type { ActionId } from '@sim/proto/action_id';

export interface UnitValue {
	value: UnitReference | undefined;
	text?: string;
	iconUrl?: string | ActionId;
	color?: string;
}
