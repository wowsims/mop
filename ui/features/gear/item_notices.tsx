import { Spec } from '@generated/proto/common';
import { MISSING_ITEM_EFFECTS } from '@sim/constants/missing_effects_auto_gen';
import type { Database } from '@sim/proto/database';
import type { ReactNode } from 'react';

export type ItemNoticeData = {
	// SpecUnknown is used as default and should always be present.
	// A falsy value disables the notice for that spec.
	[Spec.SpecUnknown]: ReactNode;
} & Record<number, ReactNode>;

// Keys are item counts for each set bonus (typically 2 and 4), values are the
// notice that should be displayed for each bonus. If null, will default to
// GENERIC_MISSING_SET_BONUS_NOTICE_DATA.
export type SetBonusNoticeData = Map<number, string> | null;

const WantToHelpMessage = () => <p className="mb-0">Want to help out by providing additional information? Contact us on our Discord!</p>;

export const MISSING_RANDOM_SUFFIX_WARNING = <p className="mb-0">Please select a random suffix</p>;

const MISSING_IMPLEMENTATION_WARNING = (
	<>
		<p className="fw-bold">This item effect (on-use or proc) is not implemented!</p>
		<p>We are working hard on gathering all the old resources to allow for an initial implementation.</p>
		<WantToHelpMessage />
	</>
);

const TENTATIVE_IMPLEMENTATION_WARNING = (
	<>
		<p>
			This item <span className="fw-bold">is</span> implemented, but detailed proc behavior will be confirmed on PTR.
		</p>
		<WantToHelpMessage />
	</>
);

const WILL_NOT_BE_IMPLEMENTED_WARNING = <>The equip/use effect on this item will not be implemented!</>;

const WILL_NOT_BE_IMPLEMENTED_ITEMS: number[] = [];

const TENTATIVE_IMPLEMENTATION_ITEMS: number[] = [95346, 95347, 95344];

export const ITEM_NOTICES = new Map<number, ItemNoticeData>([
	...WILL_NOT_BE_IMPLEMENTED_ITEMS.map((itemID): [number, ItemNoticeData] => [
		itemID,
		{
			[Spec.SpecUnknown]: WILL_NOT_BE_IMPLEMENTED_WARNING,
		},
	]),
	...TENTATIVE_IMPLEMENTATION_ITEMS.map((itemID): [number, ItemNoticeData] => [
		itemID,
		{
			[Spec.SpecUnknown]: TENTATIVE_IMPLEMENTATION_WARNING,
		},
	]),
	...[...MISSING_ITEM_EFFECTS].map(([itemID, tooltips]): [number, ItemNoticeData] => [
		itemID,
		{
			[Spec.SpecUnknown]: !tooltips.length ? (
				MISSING_IMPLEMENTATION_WARNING
			) : (
				<>
					<p className="fw-bold">The following item effect (on-use or proc) is not implemented!</p>
					<ul>
						{tooltips
							.filter(tooltip => !!tooltip)
							.map(tooltip => (
								<li key={tooltip}>{tooltip}</li>
							))}
					</ul>
				</>
			),
		},
	]),

	...[94523, 95665, 96037, 96409, 96781].map((itemID): [number, ItemNoticeData] => [
		itemID,
		{
			[Spec.SpecUnknown]: (
				<>
					<p>
						The Agility proc on this trinket has been implemented, but the Voodoo Gnomes are <span className="fw-bold">not</span> implemented. The
						DPS gain of these is around ~40 DPS.
					</p>
				</>
			),
		},
	]),

	...[].map((itemID): [number, ItemNoticeData] => [
		itemID,
		[Spec.SpecFrostMage, Spec.SpecArcaneMage, Spec.SpecFireMage].reduce<ItemNoticeData>(
			(acc, spec) => {
				acc[spec] = (
					<>
						<p>The proc has been implemented but currently does not work correctly with Mages Alter Time.</p>
					</>
				);
				return acc;
			},
			{ [Spec.SpecUnknown]: false },
		),
	]),
]);

export const GENERIC_MISSING_SET_BONUS_NOTICE_DATA = new Map<number, string>([
	[2, 'Not yet implemented'],
	[4, 'Not yet implemented'],
]);

export const SET_BONUS_NOTICES = new Map<number, SetBonusNoticeData>([]);

export const registerSetBonusNotices = (db: Database) => {
	SET_BONUS_NOTICES.forEach((value: SetBonusNoticeData, key: number) => {
		const noticeData = value || GENERIC_MISSING_SET_BONUS_NOTICE_DATA;
		const noticeContent = (
			<>
				<p className="mb-1"> This item set has the following warnings:</p>
				<ul className="mb-0">
					{Array.from(noticeData.keys()).map(pieceCount => (
						<li key={pieceCount}>
							{pieceCount.toFixed(0)}-piece: {noticeData.get(pieceCount)!}
						</li>
					))}
				</ul>
			</>
		);

		for (const id of db.getItemIdsForSet(key)) {
			ITEM_NOTICES.set(id, { [Spec.SpecUnknown]: noticeContent });
		}
	});
};
