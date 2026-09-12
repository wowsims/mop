import type { ActionId } from '@sim/proto/action_id';
import type { UnitReference } from '@generated/proto/common';

export interface UnitValue {
	value: UnitReference | undefined;
	text?: string;
	iconUrl?: string | ActionId;
	color?: string;
}
