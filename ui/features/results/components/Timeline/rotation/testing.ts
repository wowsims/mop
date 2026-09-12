import type { ActionId } from '@sim/proto/action_id';

import type { ContentRow, RotationModel, Row, RowItem } from '../../../model/timeline/rotation';

/** Enough of an `ActionId` for `useActionId` to resolve without filling. */
export const actionId = (name: string): ActionId =>
	({
		equalityKey: () => name,
		reforgeId: 0,
		iconUrl: `${name}.png`,
		name,
		anyId: () => true,
		itemId: 0,
		spellId: 1,
		spellIdTooltipOverride: 0,
	}) as unknown as ActionId;

export const castItem = (start: number, end: number): RowItem =>
	({
		kind: 'cast',
		start,
		end,
		outcome: 'hit',
		cancelled: false,
		travelStart: null,
		travelDuration: null,
		log: {
			actionId: actionId('Bolt'),
			timestamp: start,
			castTime: end - start,
			effectiveTime: end - start,
			travelTime: 0,
			cancelTime: 0,
			damageDealtLogs: [],
		},
	}) as unknown as RowItem;

const prefixMax = (items: Array<RowItem>) => items.map((_, index) => Math.max(...items.slice(0, index + 1).map(entry => entry.end)));

export const castRow = (key: string, label: string, items: Array<RowItem>): ContentRow =>
	({ kind: 'cast', key, section: 'player', height: 32, label, actionId: actionId(label), items, maxRightUpTo: prefixMax(items) }) as ContentRow;

/** A model of one section: a header and `labels.length` cast rows, each with the items given. */
export const rotationModel = (rows: Array<ContentRow>, duration = 30): RotationModel => {
	const header = { kind: 'header', key: 'header:player', section: 'player', height: 32, label: 'Player', actionId: null } as Row;
	const all: Array<Row> = [header, ...rows];
	return {
		duration,
		rows: all,
		sections: [{ id: 'player', kind: 'player', label: 'Player', separatorKey: null, headerKey: 'header:player', rowKeys: rows.map(row => row.key) }],
		byKey: new Map(all.map((row, index) => [row.key, index])),
	};
};
