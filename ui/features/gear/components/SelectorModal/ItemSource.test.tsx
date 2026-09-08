import { Profession } from '@generated/proto/common';
import { DungeonDifficulty, RepFaction, RepLevel, UIItem as Item, UIItem_FactionRestriction } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { difficultyNames, professionNames, REP_FACTION_NAMES, REP_FACTION_QUARTERMASTERS, REP_LEVEL_NAMES } from '@sim/proto/names';
import type { Sim } from '@sim/sim';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ItemSource } from './ItemSource';

interface DbStub {
	zones?: Record<number, { id: number; name: string }>;
	npcs?: Record<number, { id: number; name: string }>;
}

const sim = ({ zones = {}, npcs = {} }: DbStub = {}) =>
	({
		db: {
			getZone: (id: number) => zones[id] ?? null,
			getNpc: (id: number) => npcs[id] ?? null,
		},
	}) as unknown as Sim;

const mount = (item: Item, dbStub: DbStub = {}) => render(<ItemSource item={item} sim={sim(dbStub)} />);

describe('ItemSource', () => {
	it('links to the world drop page for an item with random suffix options and no sources', () => {
		const item = Item.create({ id: 100, sources: [], randomSuffixOptions: [1] });
		const { container, getByRole } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(`${ActionId.makeItemUrl(100)}#dropped-by`);
		expect(container.textContent).toBe('World Drop');
	});

	it('links to the pvp season for a gladiator item with no sources', () => {
		const item = Item.create({ id: 200, name: "Wrathful Gladiator's Pauldrons", sources: [], randomSuffixOptions: [] });
		const { container, getByRole } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeItemUrl(200));
		expect(container.textContent).toBe('Season 8PVP');
	});

	it('renders nothing for a plain item with no sources, no suffixes, and no pvp name', () => {
		const item = Item.create({ id: 300, name: 'Plain Sword', sources: [], randomSuffixOptions: [] });
		const { container } = mount(item);

		expect(container.innerHTML).toBe('');
	});

	it('links to the crafting spell for a crafted source with a spell id', () => {
		const item = Item.create({
			id: 400,
			sources: [{ source: { oneofKind: 'crafted', crafted: { profession: Profession.Blacksmithing, spellId: 5000 } } }],
		});
		const { container, getByRole } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeSpellUrl(5000));
		expect(container.textContent).toBe(professionNames.get(Profession.Blacksmithing));
	});

	it('links to the item page for a crafted source without a spell id', () => {
		const item = Item.create({
			id: 401,
			sources: [{ source: { oneofKind: 'crafted', crafted: { profession: Profession.Tailoring, spellId: 0 } } }],
		});
		const { getByRole } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeItemUrl(401));
	});

	it('renders nothing and logs an error when the drop source zone is unknown', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const item = Item.create({
			id: 500,
			sources: [{ source: { oneofKind: 'drop', drop: { zoneId: 1, npcId: 1, difficulty: 0, otherName: '', category: '' } } }],
		});
		const { container } = mount(item, { zones: {}, npcs: {} });

		expect(container.innerHTML).toBe('');
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('links to the npc for a drop source with a known npc, showing zone, difficulty, and npc name', () => {
		const item = Item.create({
			id: 600,
			sources: [
				{
					source: {
						oneofKind: 'drop',
						drop: { zoneId: 10, npcId: 20, difficulty: DungeonDifficulty.DifficultyRaid10H, otherName: '', category: 'Hard Mode' },
					},
				},
			],
		});
		const { container, getByRole } = mount(item, { zones: { 10: { id: 10, name: 'Icecrown Citadel' } }, npcs: { 20: { id: 20, name: 'The Lich King' } } });

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeNpcUrl(20));
		expect(container.textContent).toBe(`Icecrown Citadel (${difficultyNames.get(DungeonDifficulty.DifficultyRaid10H)})The Lich King - Hard Mode`);
	});

	it('links to the zone for a drop source with no npc but another name', () => {
		const item = Item.create({
			id: 601,
			sources: [{ source: { oneofKind: 'drop', drop: { zoneId: 11, npcId: 0, difficulty: 0, otherName: 'Trash', category: '' } } }],
		});
		const { container, getByRole } = mount(item, { zones: { 11: { id: 11, name: 'Deadwind Pass' } } });

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeZoneUrl(11));
		expect(container.textContent).toBe('Deadwind PassTrash');
	});

	it('links to the zone for a drop source with neither npc nor other name', () => {
		const item = Item.create({
			id: 602,
			sources: [{ source: { oneofKind: 'drop', drop: { zoneId: 12, npcId: 0, difficulty: 0, otherName: '', category: '' } } }],
		});
		const { container, getByRole } = mount(item, { zones: { 12: { id: 12, name: 'Stranglethorn Vale' } } });

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeZoneUrl(12));
		expect(container.textContent).toBe('Stranglethorn Vale');
	});

	it('shows an alliance icon for a quest available only to alliance', () => {
		const item = Item.create({
			id: 700,
			factionRestriction: UIItem_FactionRestriction.ALLIANCE_ONLY,
			sources: [{ source: { oneofKind: 'quest', quest: { id: 1, name: 'A Call to Arms' } } }],
		});
		const { getByRole, getByAltText } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeQuestUrl(1));
		expect(getByAltText('').getAttribute('src')).toBe('/mop/assets/img/alliance.png');
	});

	it('shows a horde icon for a quest available only to horde', () => {
		const item = Item.create({
			id: 701,
			factionRestriction: UIItem_FactionRestriction.HORDE_ONLY,
			sources: [{ source: { oneofKind: 'quest', quest: { id: 2, name: 'For the Horde' } } }],
		});
		const { getByAltText } = mount(item);

		expect(getByAltText('').getAttribute('src')).toBe('/mop/assets/img/horde.png');
	});

	it('shows no faction icon for a quest with no faction restriction', () => {
		const item = Item.create({
			id: 702,
			factionRestriction: UIItem_FactionRestriction.UNSPECIFIED,
			sources: [{ source: { oneofKind: 'quest', quest: { id: 3, name: 'Neutral Ground' } } }],
		});
		const { container, queryByRole } = mount(item);

		expect(queryByRole('img')).toBeNull();
		expect(container.textContent).toBe('QuestNeutral Ground');
	});

	it('finds and renders a rep source even when it is not the first entry', () => {
		const item = Item.create({
			id: 800,
			sources: [
				{ source: { oneofKind: 'soldBy', soldBy: { npcId: 1, npcName: 'Ignored Vendor', zoneId: 0 } } },
				{ source: { oneofKind: 'rep', rep: { repFactionId: RepFaction.RepFactionTheKlaxxi, repLevel: RepLevel.RepLevelRevered, factionId: 0 } } },
			],
		});
		const { container, getByRole } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeNpcUrl(REP_FACTION_QUARTERMASTERS[RepFaction.RepFactionTheKlaxxi]));
		expect(container.querySelectorAll('span')).toHaveLength(2);
		expect(container.textContent).toBe(`${REP_FACTION_NAMES[RepFaction.RepFactionTheKlaxxi]}${REP_LEVEL_NAMES[RepLevel.RepLevelRevered]}`);
	});

	it('links to the vendor for a soldBy source', () => {
		const item = Item.create({
			id: 900,
			sources: [{ source: { oneofKind: 'soldBy', soldBy: { npcId: 5, npcName: "Sha'tari Quartermaster", zoneId: 0 } } }],
		});
		const { container, getByRole } = mount(item);

		expect(getByRole('link').getAttribute('href')).toBe(ActionId.makeNpcUrl(5));
		expect(container.textContent).toBe(`Sold by${"Sha'tari Quartermaster"}`);
	});

	it('opens external links in a new tab with a rel attribute', () => {
		const item = Item.create({ id: 1000, sources: [], randomSuffixOptions: [1] });
		const { getByRole } = mount(item);

		expect(getByRole('link').getAttribute('target')).toBe('_blank');
		expect(getByRole('link').getAttribute('rel')).toBeTruthy();
	});
});
