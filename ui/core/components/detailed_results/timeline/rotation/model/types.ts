import type { ActionId } from '../../../../../proto_utils/action_id';
import type { AuraUptimeLog, CastLog, DamageDealtLog, ResourceChangedLogGroup } from '../../../../../proto_utils/logs_parser';
import type SecondaryResource from '../../../../../proto_utils/secondary_resource';
import type { UnitMetrics } from '../../../../../proto_utils/sim_result';

export const ROW_HEIGHTS = { cast: 32, aura: 32, resource: 32, header: 32, separator: 17 } as const;

export type SectionId = string;

export type SectionKind = 'player' | 'pet' | 'buffs' | 'targetCasts' | 'targetDebuffs';

export interface Section {
	id: SectionId;
	kind: SectionKind;
	label: string;
	separatorKey: string | null;
	headerKey: string | null;
	rowKeys: Array<string>;
}

export type CastOutcome = 'hit' | 'crit' | 'miss' | 'partial' | 'cancelled' | 'none';

export interface CastItem {
	kind: 'cast';
	start: number;
	end: number;
	outcome: CastOutcome;
	cancelled: boolean;
	travelStart: number | null;
	travelDuration: number | null;
	log: CastLog;
}

export interface TickItem {
	kind: 'tick';
	start: number;
	end: number;
	log: DamageDealtLog;
}

export interface AuraStackSegment {
	offset: number;
	duration: number;
	stacks: number;
}

export interface AuraItem {
	kind: 'aura';
	start: number;
	end: number;
	stacks: Array<AuraStackSegment>;
	sharesRowWithCast: boolean;
	log: AuraUptimeLog;
}

export type ResourceDisplay = 'percent' | 'fill' | 'number';

export interface ResourceItem {
	kind: 'resource';
	start: number;
	end: number;
	startValue: number;
	display: ResourceDisplay;
	fillPercent: number;
	text: string;
	log: ResourceChangedLogGroup;
}

export type RowItem = CastItem | TickItem | AuraItem | ResourceItem;

interface RowBase {
	key: string;
	section: SectionId;
	height: number;
}

interface ContentRowBase extends RowBase {
	label: string;
	items: Array<RowItem>;
	maxRightUpTo: Array<number>;
}

export interface CastRow extends ContentRowBase {
	kind: 'cast';
	actionId: ActionId;
}

export interface AuraRow extends ContentRowBase {
	kind: 'aura';
	actionId: ActionId;
}

export interface ResourceRow extends ContentRowBase {
	kind: 'resource';
	icon: string;
	cssName: string;
}

export interface HeaderRow extends RowBase {
	kind: 'header';
	label: string;
	actionId: ActionId | null;
}

export interface SeparatorRow extends RowBase {
	kind: 'separator';
}

export type ContentRow = CastRow | AuraRow | ResourceRow;

export type Row = ContentRow | HeaderRow | SeparatorRow;

export interface RotationModel {
	duration: number;
	rows: Array<Row>;
	sections: Array<Section>;
	byKey: Map<string, number>;
}

export interface BuildRotationModelParams {
	player: UnitMetrics;
	targets: Array<UnitMetrics>;
	duration: number;
	secondaryResource?: SecondaryResource | null;
}
