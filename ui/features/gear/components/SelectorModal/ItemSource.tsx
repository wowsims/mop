import { RepFaction, UIItem as Item, UIItem_FactionRestriction } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { getPVPSeasonFromItem, isPVPItem } from '@sim/proto/items';
import { difficultyNames, professionNames, REP_FACTION_NAMES, REP_FACTION_QUARTERMASTERS, REP_LEVEL_NAMES } from '@sim/proto/names';
import type { Sim } from '@sim/sim';
import { externalRel } from '@sim/utils/links';
import type { ReactNode } from 'react';

export interface ItemSourceProps {
	item: Item;
	sim: Sim;
}

const FactionIcon = ({ restriction }: { restriction: UIItem_FactionRestriction }) => {
	if (restriction === UIItem_FactionRestriction.ALLIANCE_ONLY)
		return <img src="/mop/assets/img/alliance.png" className="ms-1" width="15" height="15" alt="" />;
	if (restriction === UIItem_FactionRestriction.HORDE_ONLY) return <img src="/mop/assets/img/horde.png" className="ms-1" width="15" height="15" alt="" />;
	return null;
};

const SourceLink = ({ href, children }: { href: string; children: ReactNode }) => (
	<a href={href} target="_blank" rel={externalRel(href, undefined)}>
		<small>{children}</small>
	</a>
);

export const ItemSource = ({ item, sim }: ItemSourceProps): ReactNode => {
	const pvp = () => {
		const season = getPVPSeasonFromItem(item);
		if (!season) return null;
		return (
			<SourceLink href={ActionId.makeItemUrl(item.id)}>
				<span>
					{season}
					<br />
					PVP
				</span>
			</SourceLink>
		);
	};

	if (!item.sources?.length) {
		if (item.randomSuffixOptions.length) return <SourceLink href={`${ActionId.makeItemUrl(item.id)}#dropped-by`}>World Drop</SourceLink>;
		if (isPVPItem(item)) return pvp();
		return null;
	}

	let source = item.sources[0];
	if (source.source.oneofKind === 'crafted') {
		const src = source.source.crafted;
		const href = src.spellId ? ActionId.makeSpellUrl(src.spellId) : ActionId.makeItemUrl(item.id);
		return <SourceLink href={href}>{professionNames.get(src.profession) ?? 'Unknown'}</SourceLink>;
	}

	if (source.source.oneofKind === 'drop') {
		const src = source.source.drop;
		const zone = sim.db.getZone(src.zoneId);
		const npc = sim.db.getNpc(src.npcId);
		if (!zone) {
			console.error('No zone found for item:', item);
			return null;
		}

		const category = src.category ? ` - ${src.category}` : '';
		if (npc) {
			return (
				<SourceLink href={ActionId.makeNpcUrl(npc.id)}>
					<span>
						{zone.name} ({difficultyNames.get(src.difficulty) ?? 'Unknown'})
						<br />
						{npc.name + category}
					</span>
				</SourceLink>
			);
		}
		if (src.otherName) {
			return (
				<SourceLink href={ActionId.makeZoneUrl(zone.id)}>
					<span>
						{zone.name}
						<br />
						{src.otherName}
					</span>
				</SourceLink>
			);
		}
		return <SourceLink href={ActionId.makeZoneUrl(zone.id)}>{zone.name}</SourceLink>;
	}

	if (source.source.oneofKind === 'quest' && source.source.quest.name) {
		const src = source.source.quest;
		return (
			<SourceLink href={ActionId.makeQuestUrl(src.id)}>
				<span>
					Quest
					<FactionIcon restriction={item.factionRestriction} />
					<br />
					{src.name}
				</span>
			</SourceLink>
		);
	}

	if ((source = item.sources.find(entry => entry.source.oneofKind === 'rep') ?? source).source.oneofKind === 'rep') {
		const factionNames = item.sources
			.filter(entry => entry.source.oneofKind === 'rep')
			.map(entry =>
				entry.source.oneofKind === 'rep' ? REP_FACTION_NAMES[entry.source.rep.repFactionId] : REP_FACTION_NAMES[RepFaction.RepFactionUnknown],
			);
		const src = source.source.rep;
		return (
			<SourceLink href={ActionId.makeNpcUrl(REP_FACTION_QUARTERMASTERS[src.repFactionId])}>
				{factionNames.map((name, index) => (
					<span key={`${name}-${index}`}>
						{name}
						<FactionIcon restriction={item.factionRestriction} />
						<br />
					</span>
				))}
				<span>{REP_LEVEL_NAMES[src.repLevel]}</span>
			</SourceLink>
		);
	}

	if (isPVPItem(item)) return pvp();

	if (source.source.oneofKind === 'soldBy') {
		const src = source.source.soldBy;
		return (
			<SourceLink href={ActionId.makeNpcUrl(src.npcId)}>
				<span>
					Sold by
					<br />
					{src.npcName}
				</span>
			</SourceLink>
		);
	}

	return null;
};
