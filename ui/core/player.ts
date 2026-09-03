import * as Mechanics from './constants/mechanics';
import { CURRENT_API_VERSION } from './constants/other';
import { SimSettingCategories } from './constants/sim_settings';
import { MAX_PARTY_SIZE, Party } from './party';
import { PlayerClass } from './player_class';
import { PlayerSpec } from './player_spec';
import { PlayerSpecs } from './player_specs';
import type { PresetEpWeights } from './preset_utils';
import {
	AuraStats as AuraStatsProto,
	Player as PlayerProto,
	PlayerStats,
	SpellStats as SpellStatsProto,
	StatWeightsResult,
	UnitMetadata as UnitMetadataProto,
} from './proto/api';
import { APLRotation, APLRotation_Type as APLRotationType, SimpleRotation } from './proto/apl';
import {
	Class,
	ConsumableType,
	ConsumesSpec,
	Cooldowns,
	Faction,
	GemColor,
	Glyphs,
	HandType,
	HealingModel,
	IndividualBuffs,
	ItemLevelState,
	ItemRandomSuffix,
	ItemSlot,
	Profession,
	PseudoStat,
	Race,
	RangedWeaponType,
	ReforgeStat,
	Spec,
	Stat,
	UnitReference,
	UnitStats,
	WeaponType,
} from './proto/common';
import { SimDatabase } from './proto/db';
import {
	DungeonDifficulty,
	RaidFilterOption,
	SourceFilterOption,
	UIEnchant as Enchant,
	UIGem as Gem,
	UIItem as Item,
	UIItem_FactionRestriction,
} from './proto/ui';
import { ActionId } from './proto_utils/action_id';
import { Database } from './proto_utils/database';
import { EquippedItem, ReforgeData } from './proto_utils/equipped_item';
import { Gear, ItemSwapGear } from './proto_utils/gear';
import { gemMatchesSocket, isUnrestrictedGem } from './proto_utils/gems';
import SecondaryResource from './proto_utils/secondary_resource';
import { Stats } from './proto_utils/stats';
import {
	AL_CATEGORY_HARD_MODE,
	canEquipEnchant,
	canEquipItem,
	ClassOptions,
	ClassSpecs,
	emptyUnitReference,
	enchantAppliesToItem,
	getMetaGemEffectEP,
	getTalentTreePoints,
	isPVPItem,
	newUnitReference,
	raceToFaction,
	SpecClasses,
	SpecOptions,
	SpecRotation,
	SpecTalents,
	SpecTypeFunctions,
	specTypeFunctions,
	withSpec,
} from './proto_utils/utils';
import { Raid } from './raid';
import { Sim } from './sim';
import { batch, EventID, nextEventID } from './state/batch';
import { ItemSwapSettings } from './state/item_swap_settings';
import { deleteKeyed, patchKeyed, PLAYER_FIELDS, PlayerField, PlayerSlice, seedKeyed, zeroVersions } from './state/sim_store';
import { subscribePlayerField } from './state/subscriptions';
import { playerTalentStringToProto } from './talents/factory';
import { omitDeep, stringComparator, sum } from './utils';
import { WorkerProgressCallback } from './worker_pool';

export interface AuraStats {
	data: AuraStatsProto;
	id: ActionId;
}
export interface SpellStats {
	data: SpellStatsProto;
	id: ActionId;
}

export class UnitMetadata {
	private name: string;
	private auras: Array<AuraStats>;
	private spells: Array<SpellStats>;

	constructor() {
		this.name = '';
		this.auras = [];
		this.spells = [];
	}

	getName(): string {
		return this.name;
	}

	getAuras(): Array<AuraStats> {
		return this.auras.slice();
	}

	getSpells(): Array<SpellStats> {
		return this.spells.slice();
	}

	// Returns whether any updates were made.
	async update(metadata: UnitMetadataProto): Promise<boolean> {
		let newSpells = metadata!.spells.map(spell => {
			return {
				data: spell,
				id: ActionId.fromProto(spell.id!),
			};
		});
		let newAuras = metadata!.auras.map(aura => {
			return {
				data: aura,
				id: ActionId.fromProto(aura.id!),
			};
		});

		await Promise.all([...newSpells, ...newAuras].map(newSpell => newSpell.id.fill().then(newId => (newSpell.id = newId))));

		newSpells = newSpells.sort((a, b) => stringComparator(a.id.name, b.id.name));
		newAuras = newAuras.sort((a, b) => stringComparator(a.id.name, b.id.name));

		let anyUpdates = false;
		if (metadata.name != this.name) {
			this.name = metadata.name;
			anyUpdates = true;
		}
		if (newSpells.length != this.spells.length || newSpells.some((newSpell, i) => !newSpell.id.equals(this.spells[i].id))) {
			this.spells = newSpells;
			anyUpdates = true;
		}
		if (newAuras.length != this.auras.length || newAuras.some((newAura, i) => !newAura.id.equals(this.auras[i].id))) {
			this.auras = newAuras;
			anyUpdates = true;
		}

		return anyUpdates;
	}
}

export class UnitMetadataList {
	private metadatas: Array<UnitMetadata>;

	constructor() {
		this.metadatas = [];
	}

	async update(newMetadatas: Array<UnitMetadataProto>): Promise<boolean> {
		const oldLen = this.metadatas.length;

		if (newMetadatas.length > oldLen) {
			for (let i = oldLen; i < newMetadatas.length; i++) {
				this.metadatas.push(new UnitMetadata());
			}
		} else if (newMetadatas.length < oldLen) {
			this.metadatas = this.metadatas.slice(0, newMetadatas.length);
		}

		const anyUpdates = await Promise.all(newMetadatas.map((metadata, i) => this.metadatas[i].update(metadata)));

		return oldLen != this.metadatas.length || anyUpdates.some(v => v);
	}

	asList(): Array<UnitMetadata> {
		return this.metadatas.slice();
	}
}

export interface MeleeCritCapInfo {
	meleeCrit: number;
	meleeHit: number;
	expertise: number;
	suppression: number;
	glancing: number;
	hasOffhandWeapon: boolean;
	meleeHitCap: number;
	expertiseCap: number;
	remainingMeleeHitCap: number;
	remainingExpertiseCap: number;
	baseCritCap: number;
	specSpecificOffset: number;
	playerCritCapDelta: number;
}

export type AutoRotationGenerator<SpecType extends Spec> = (player: Player<SpecType>) => APLRotation;
export type SimpleRotationGenerator<SpecType extends Spec> = (
	player: Player<SpecType>,
	simpleRotation: SpecRotation<SpecType>,
	cooldowns: Cooldowns,
) => APLRotation;

export interface PlayerConfig<SpecType extends Spec> {
	autoRotation: AutoRotationGenerator<SpecType>;
	simpleRotation?: SimpleRotationGenerator<SpecType>;
	hiddenMCDs?: Array<number>; // spell IDs for any MCDs that should be omitted from the Simple Cooldowns UI
	secondaryResource?: SecondaryResource | null;
}

// The subset of the per-spec UI config (IndividualSimUIConfig) that the domain
// layer consumes. Spec configs registered via registerSpecConfig satisfy this
// structurally; the full UI config type stays in individual_sim_ui.
export interface SpecConfigData<SpecType extends Spec> extends PlayerConfig<SpecType> {
	epStats: Array<Stat>;
	consumableStats?: Array<Stat>;
	gemStats?: Array<Stat>;
	presets: {
		epWeights: Array<PresetEpWeights>;
	};
}

const SPEC_CONFIGS: Partial<Record<Spec, PlayerConfig<any>>> = {};

export function registerSpecConfig<SpecType extends Spec>(spec: SpecType, config: PlayerConfig<SpecType>) {
	SPEC_CONFIGS[spec] = config;
}

export function getSpecConfig<SpecType extends Spec>(spec: SpecType): PlayerConfig<SpecType> {
	const config = SPEC_CONFIGS[spec] as PlayerConfig<SpecType>;
	if (!config) {
		throw new Error('No config registered for Spec: ' + spec);
	}
	config.secondaryResource = SecondaryResource.create(spec);
	return config;
}

// Manages all the gear / consumes / other settings for a single Player.
export class Player<SpecType extends Spec> {
	readonly sim: Sim;
	private party: Party | null;
	private raid: Raid | null;

	readonly playerSpec: PlayerSpec<SpecType>;
	readonly playerClass: PlayerClass<SpecClasses<SpecType>>;
	readonly secondaryResource?: SecondaryResource | null;

	// Settings fields live in the sim store (players[storeKey]); see PlayerSlice.
	//private bulkEquipmentSpec: BulkEquipmentSpec = BulkEquipmentSpec.create();
	itemSwapSettings: ItemSwapSettings;
	private aplRotation_: APLRotation = APLRotation.create();

	// Read-only access: the returned rotation is the live object — do NOT mutate
	// it directly; route writes through setAplRotation/modifyAplRotation.
	get aplRotation(): APLRotation {
		return this.aplRotation_;
	}

	private healingEnabled = false;

	private readonly autoRotationGenerator: AutoRotationGenerator<SpecType> | null = null;
	private readonly simpleRotationGenerator: SimpleRotationGenerator<SpecType> | null = null;
	readonly hiddenMCDs: Array<number>;

	private itemEPCache = new Array<Map<string, number>>();
	private gemEPCache = new Map<number, number>();
	private randomSuffixEPCache = new Map<number, number>();
	private enchantEPCache = new Map<number, number>();
	private upgradeEPCache = new Map<string, number>();
	private talents: SpecTalents<SpecType> | null = null;
	private specConfig: SpecConfigData<SpecType>;

	readonly specTypeFunctions: SpecTypeFunctions<SpecType>;

	private static readonly numEpRatios = 6;
	private metadata: UnitMetadata = new UnitMetadata();
	private petMetadatas: UnitMetadataList = new UnitMetadataList();

	private static nextStoreKey = 0;
	// Key of this player's slice in sim.store; unique per Player instance.
	// Call dispose() when an instance is discarded (see state/README.md).
	readonly storeKey = Player.nextStoreKey++;
	private readonly unsubscribers: Array<() => void> = [];
	private disposed = false;

	private slice() {
		return this.sim.store.getState().players[this.storeKey];
	}

	// Writes `patch` and bumps the given version counters in one store write.
	// The bump is what subscribers watch, so a setter notifies exactly when it
	// calls write() — guard logic stays in the setters. Counter-only fields
	// (rotation, itemSwap, epRefStat) are bumped with an empty patch.
	private write(patch: Partial<Omit<PlayerSlice, 'v'>>, bumps: ReadonlyArray<PlayerField>) {
		patchKeyed(this.sim.store, 'players', this.storeKey, patch, bumps);
	}

	// Writes one field and bumps its version.
	private patch<F extends Exclude<PlayerField, 'rotation' | 'itemSwap' | 'epRefStat'>>(field: F, value: PlayerSlice[F]) {
		this.write({ [field]: value } as Partial<Omit<PlayerSlice, 'v'>>, [field]);
	}

	// Signals a rotation change made in place on `aplRotation` (APL editor).
	touchRotation(eventID: EventID) {
		this.write({}, ['rotation']);
	}

	// Item-swap fields share one version counter (ItemSwapSettings facade).
	patchItemSwap(eventID: EventID, patch: { itemSwapEnabled?: boolean; itemSwapGear?: ItemSwapGear; itemSwapBonusStats?: Stats }) {
		this.write(patch, ['itemSwap']);
	}

	getItemSwapField<F extends 'itemSwapEnabled' | 'itemSwapGear' | 'itemSwapBonusStats'>(field: F): PlayerSlice[F] {
		return this.slice()[field];
	}

	constructor(spec: PlayerSpec<SpecType>, sim: Sim) {
		this.sim = sim;
		this.party = null;
		this.raid = null;

		this.playerSpec = spec;
		this.playerClass = PlayerSpecs.getPlayerClass(spec);

		this.specTypeFunctions = specTypeFunctions[this.getSpec()] as SpecTypeFunctions<SpecType>;

		// Seed this player's slice (field initialization, not a change).
		seedKeyed(this.sim.store, 'players', this.storeKey, {
			name: '',
			race: this.playerClass.races[0],
			profession1: 0,
			profession2: 0,
			buffs: IndividualBuffs.create(),
			consumables: ConsumesSpec.create(),
			bonusStats: new Stats(),
			gear: new Gear({}),
			talentsString: '',
			glyphs: Glyphs.create(),
			specOptions: this.specTypeFunctions.optionsCreate(),
			reactionTime: 0,
			channelClipDelay: 0,
			inFrontOfTarget: false,
			distanceFromTarget: 0,
			healingModel: HealingModel.create(),
			challengeModeEnabled: false,
			epWeights: new Stats(),
			epRatios: new Array<number>(Player.numEpRatios).fill(0),
			currentStats: PlayerStats.create(),
			itemSwapEnabled: false,
			itemSwapGear: new ItemSwapGear({}),
			itemSwapBonusStats: new Stats(),
			dpsRefStat: undefined,
			healRefStat: undefined,
			tankRefStat: undefined,
			v: zeroVersions(PLAYER_FIELDS),
		});

		this.specConfig = getSpecConfig<SpecType>(this.getSpec()) as SpecConfigData<SpecType>;
		this.secondaryResource = this.specConfig.secondaryResource;

		this.autoRotationGenerator = this.specConfig.autoRotation;
		if (this.specConfig.simpleRotation) {
			this.simpleRotationGenerator = this.specConfig.simpleRotation;
		} else {
			this.simpleRotationGenerator = null;
		}
		this.hiddenMCDs = this.specConfig.hiddenMCDs || new Array<number>();

		for (let i = 0; i < ItemSlot.ItemSlotOffHand + 1; ++i) {
			this.itemEPCache[i] = new Map();
		}

		this.itemSwapSettings = new ItemSwapSettings(this);

		this.bindChallengeModeChange();
	}

	bindChallengeModeChange() {
		// Re-apply gear with the new challenge-mode scaling once the write
		// (or the batch containing it) completes.
		this.unsubscribers.push(
			subscribePlayerField(
				this,
				'challengeModeEnabled',
			)(() => {
				this.setGear(nextEventID(), this.getGear(), true);
			}),
		);
	}

	// Releases this instance's store subscriptions and slices. Only call when
	// the Player is genuinely discarded (replaced by a different instance and
	// referenced nowhere else) — a player moved between parties is NOT discarded.
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.unsubscribers.splice(0).forEach(u => u());
		// Drop the slices on the next tick: pickers bound to this player are
		// replaced by the UI's own (gated) composition subscribers first, so they
		// are already off the DOM — and self-dispose — when their selectors see
		// the slice disappear.
		setTimeout(() => deleteKeyed(this.sim.store, this.storeKey), 0);
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	// Stat-weight reference stats (persisted with the settings; one shared
	// 'epRefStat' version counter).
	getRefStat(kind: 'dpsRefStat' | 'healRefStat' | 'tankRefStat'): Stat | undefined {
		return this.slice()[kind] as Stat | undefined;
	}

	setRefStat(eventID: EventID, kind: 'dpsRefStat' | 'healRefStat' | 'tankRefStat', stat: Stat | undefined) {
		if (this.slice()[kind] === stat) return;
		this.write({ [kind]: stat }, ['epRefStat']);
	}

	getSpecIcon(): string {
		return this.playerSpec.getIcon('medium');
	}

	getPlayerSpec(): PlayerSpec<SpecType> {
		return this.playerSpec;
	}

	getSpec(): SpecType {
		return this.getPlayerSpec().specID;
	}

	getPlayerClass(): PlayerClass<SpecClasses<SpecType>> {
		return this.playerClass;
	}

	getClass(): SpecClasses<SpecType> {
		return this.playerSpec.classID;
	}

	getClassColor(): string {
		return this.playerClass.hexColor;
	}

	canEnableTargetDummies(): boolean {
		const healingSpellClasses: Class[] = [Class.ClassDruid, Class.ClassPaladin, Class.ClassPriest, Class.ClassShaman, Class.ClassMonk];
		return healingSpellClasses.includes(this.getClass());
	}

	shouldEnableTargetDummies(): boolean {
		if (this.getPlayerSpec().isHealingSpec || this.getPlayerSpec().isTankSpec) {
			return true;
		}

		if (!this.itemSwapSettings.getEnableItemSwap()) {
			return false;
		}

		// Not comprehensive, add other relevant IDs here as needed.
		const healingProcTrinkets: number[] = [72898, 77969, 77204, 77989];

		return this.itemSwapSettings.getGear().hasTrinketFromOptions(healingProcTrinkets);
	}

	// TODO: Cata - Check this
	isSpec<T extends Spec>(specId: T): this is Player<T> {
		return (this.getSpec() as unknown) == specId;
	}

	isClass<T extends Class>(classId: T): this is Player<ClassSpecs<T>> {
		return (this.getClass() as unknown) == classId;
	}

	getParty(): Party | null {
		return this.party;
	}

	getRaid(): Raid | null {
		return this.raid;
	}

	// Returns this player's index within its party [0-4].
	getPartyIndex(): number {
		if (this.party == null) {
			throw new Error("Can't get party index for player without a party!");
		}

		return this.party.getPlayers().indexOf(this);
	}

	// Returns this player's index within its raid [0-24].
	getRaidIndex(): number {
		if (this.party == null) {
			throw new Error("Can't get raid index for player without a party!");
		}

		return this.party.getIndex() * MAX_PARTY_SIZE + this.getPartyIndex();
	}

	// This should only ever be called from party.
	setParty(newParty: Party | null) {
		if (newParty == null) {
			this.party = null;
			this.raid = null;
		} else {
			this.party = newParty;
			this.raid = newParty.raid;
		}
	}

	getOtherPartyMembers(): Array<Player<any>> {
		if (this.party == null) {
			return [];
		}

		return this.party.getPlayers().filter(player => player != null && player != this) as Array<Player<any>>;
	}

	// Returns all items that this player can wear in the given slot.
	getItems(slot: ItemSlot): Array<Item> {
		return this.sim.db.getItems(slot).filter(item => canEquipItem(item, this.playerSpec, slot));
	}

	// Returns all random suffixes that this player would be interested in for the given base item.
	getRandomSuffixes(item: Item): Array<ItemRandomSuffix> {
		return item.randomSuffixOptions
			.map(id => this.sim.db.getRandomSuffixById(id))
			.filter((suffix): suffix is ItemRandomSuffix => !!suffix && this.computeRandomSuffixEP(suffix) > 0);
	}

	// Returns all reforgings that are valid with a given item
	getAvailableReforgings(equippedItem: EquippedItem): Array<ReforgeData> {
		return this.sim.db.getAvailableReforges(equippedItem.item).map(reforge => equippedItem.getReforgeData(reforge)!);
	}

	// Returns reforge given an id
	getReforge(id: number): ReforgeStat | undefined {
		return this.sim.db.getReforgeById(id);
	}

	// Returns all enchants that this player can wear in the given slot.
	getEnchants(slot: ItemSlot): Array<Enchant> {
		return this.sim.db.getEnchants(slot).filter(enchant => canEquipEnchant(enchant, this.playerSpec));
	}

	// Returns all tinkers that this player can wear in the given slot.
	// For the purpose of this function, they are all enchants still, however we split them since you can have both on the same item.
	getTinkers(slot: ItemSlot): Array<Enchant> {
		return this.sim.db.getEnchants(slot).filter(enchant => enchant.requiredProfession == Profession.Engineering);
	}

	// Returns all gems that this player can wear of the given color.
	getGems(socketColor?: GemColor): Array<Gem> {
		return this.sim.db.getGems(socketColor);
	}

	getEpWeights(): Stats {
		return this.slice().epWeights;
	}

	setEpWeights(eventID: EventID, newEpWeights: Stats) {
		this.patch('epWeights', newEpWeights);

		this.gemEPCache = new Map();
		this.enchantEPCache = new Map();
		this.randomSuffixEPCache = new Map();
		this.upgradeEPCache = new Map();
		for (let i = 0; i < ItemSlot.ItemSlotOffHand + 1; ++i) {
			this.itemEPCache[i] = new Map();
		}
	}

	getDefaultEpRatios(isTankSpec: boolean, isHealingSpec: boolean): Array<number> {
		const defaultRatios = new Array(Player.numEpRatios).fill(0);
		if (isHealingSpec) {
			// By default only value HPS EP for healing spec
			defaultRatios[1] = 1;
		} else if (isTankSpec) {
			// By default value TPS and DTPS EP equally for tanking spec
			defaultRatios[2] = 1;
			defaultRatios[3] = 1;
			if (this.getSpec() == Spec.SpecBloodDeathKnight) {
				// Add healing EPs for BDKs
				defaultRatios[1] = 1;
			}
		} else {
			// By default only value DPS EP
			defaultRatios[0] = 1;
		}

		return defaultRatios;
	}

	getEpRatios() {
		return this.slice().epRatios.slice();
	}

	setEpRatios(eventID: EventID, newRatios: Array<number>) {
		this.patch('epRatios', newRatios);
	}

	hasCustomEPWeights(): boolean {
		return !this.getSpecConfig().presets.epWeights.some(epw => epw.epWeights.equals(this.getEpWeights()));
	}

	// Error display (toasts) is the caller's responsibility; a result with
	// result.error set or a thrown error must be handled by the UI layer.
	async computeStatWeights(
		_eventID: EventID,
		epStats: Array<Stat>,
		epPseudoStats: Array<PseudoStat>,
		epReferenceStat: Stat,
		onProgress: WorkerProgressCallback,
	): Promise<StatWeightsResult> {
		return await this.sim.statWeights(this, epStats, epPseudoStats, epReferenceStat, onProgress);
	}

	getCurrentStats(): PlayerStats {
		return PlayerStats.clone(this.slice().currentStats);
	}

	setCurrentStats(eventID: EventID, newStats: PlayerStats) {
		this.patch('currentStats', newStats);
	}

	getMetadata(): UnitMetadata {
		return this.metadata;
	}

	getPetMetadatas(): UnitMetadataList {
		return this.petMetadatas;
	}

	async updateMetadata(): Promise<boolean> {
		const currentStats = this.slice().currentStats;
		const playerPromise = this.metadata.update(currentStats.metadata!);
		const petsPromise = this.petMetadatas.update(currentStats.pets.map(p => p.metadata!));
		const playerUpdated = await playerPromise;
		const petsUpdated = await petsPromise;
		return playerUpdated || petsUpdated;
	}

	getName(): string {
		return this.slice().name;
	}
	setName(eventID: EventID, newName: string) {
		if (newName != this.getName()) {
			this.patch('name', newName);
		}
	}

	getLabel(): string {
		if (this.party) {
			return `${this.getName()} (#${this.getRaidIndex() + 1})`;
		} else {
			return this.getName();
		}
	}

	getRace(): Race {
		return this.slice().race;
	}
	setRace(eventID: EventID, newRace: Race) {
		if (newRace != this.getRace()) {
			this.patch('race', newRace);
		}
	}

	getProfession1(): Profession {
		return this.slice().profession1 as Profession;
	}
	setProfession1(eventID: EventID, newProfession: Profession) {
		if (newProfession != this.getProfession1()) {
			this.patch('profession1', newProfession);
		}
	}
	getProfession2(): Profession {
		return this.slice().profession2 as Profession;
	}
	setProfession2(eventID: EventID, newProfession: Profession) {
		if (newProfession != this.getProfession2()) {
			this.patch('profession2', newProfession);
		}
	}
	getProfessions(): Array<Profession> {
		return [this.getProfession1(), this.getProfession2()].filter(p => p != Profession.ProfessionUnknown);
	}
	setProfessions(eventID: EventID, newProfessions: Array<Profession>) {
		batch(() => {
			this.setProfession1(eventID, newProfessions[0] || Profession.ProfessionUnknown);
			this.setProfession2(eventID, newProfessions[1] || Profession.ProfessionUnknown);
		});
	}
	hasProfession(prof: Profession): boolean {
		return this.getProfessions().includes(prof);
	}
	isBlacksmithing(): boolean {
		return this.hasProfession(Profession.Blacksmithing);
	}

	getFaction(): Faction {
		return raceToFaction[this.getRace()];
	}

	getBuffs(): IndividualBuffs {
		// Make a defensive copy
		return IndividualBuffs.clone(this.slice().buffs);
	}

	setBuffs(eventID: EventID, newBuffs: IndividualBuffs) {
		if (IndividualBuffs.equals(this.slice().buffs, newBuffs)) return;

		// Make a defensive copy
		this.patch('buffs', IndividualBuffs.clone(newBuffs));
	}

	getConsumes(forSimming?: boolean): ConsumesSpec {
		const epStats = [...(this.specConfig.consumableStats ?? []), ...this.specConfig.epStats];
		const flasks = this.sim.db.getConsumablesByTypeAndStats(ConsumableType.ConsumableTypeFlask, epStats);
		const battleElixirs = this.sim.db.getConsumablesByTypeAndStats(ConsumableType.ConsumableTypeBattleElixir, epStats);
		const guardianElixirs = this.sim.db.getConsumablesByTypeAndStats(ConsumableType.ConsumableTypeGuardianElixir, epStats);

		if (forSimming) {
			return ConsumesSpec.create({
				...this.slice().consumables,
				consumableIds: [...flasks, ...battleElixirs, ...guardianElixirs].map(c => c.id),
			});
		}
		// Make a defensive copy
		return ConsumesSpec.clone({ ...this.slice().consumables, consumableIds: [] });
	}

	setConsumes(eventID: EventID, newConsumes: ConsumesSpec) {
		if (ConsumesSpec.equals(this.slice().consumables, newConsumes)) return;

		// Make a defensive copy
		this.patch('consumables', ConsumesSpec.clone(newConsumes));
	}

	canDualWield2H(): boolean {
		return this.getSpec() == Spec.SpecFuryWarrior;
	}

	equipItem(eventID: EventID, slot: ItemSlot, newItem: EquippedItem | null) {
		this.setGear(eventID, this.getGear().withEquippedItem(slot, newItem, this.canDualWield2H()));
	}

	getEquippedItem(slot: ItemSlot): EquippedItem | null {
		return this.getGear().getEquippedItem(slot);
	}

	getEquippedItems(): Array<EquippedItem | null> {
		return this.getGear().getEquippedItems();
	}

	getGear(): Gear {
		return this.slice().gear;
	}

	setGear(eventID: EventID, newGear: Gear, forceUpdate?: boolean) {
		if (newGear.equals(this.getGear()) && !forceUpdate) return;
		this.patch('gear', newGear.withChallengeMode(this.getChallengeModeEnabled()));
	}

	async setGearAsync(eventID: EventID, newGear: Gear, forceUpdate?: boolean) {
		if (newGear.equals(this.getGear()) && !forceUpdate) return;
		const statsUpdatePromise = new Promise<void>(resolve => {
			const unsub = this.sim.store.subscribe(
				s => s.players[this.storeKey]?.v.currentStats,
				() => {
					unsub();
					resolve();
				},
			);
		});
		this.setGear(eventID, newGear);
		await statsUpdatePromise;
	}

	getBonusStats(): Stats {
		return this.slice().bonusStats;
	}

	setBonusStats(eventID: EventID, newBonusStats: Stats) {
		if (newBonusStats.equals(this.getBonusStats())) return;

		this.patch('bonusStats', newBonusStats);
	}

	getMeleeCritCapInfo(): MeleeCritCapInfo {
		const currentStats = this.slice().currentStats;
		const meleeCrit = currentStats.finalStats?.pseudoStats[PseudoStat.PseudoStatPhysicalCritPercent] || 0.0;
		const meleeHit = currentStats.finalStats?.pseudoStats[PseudoStat.PseudoStatPhysicalHitPercent] || 0.0;
		const expertise = (currentStats.finalStats?.stats[Stat.StatExpertiseRating] || 0.0) / Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION / 4;
		//const agility = (this.currentStats.finalStats?.stats[Stat.StatAgility] || 0.0) / this.getClass();
		const suppression = 3.0;
		const glancing = 24.0;

		const hasOffhandWeapon = this.getGear().getEquippedItem(ItemSlot.ItemSlotOffHand)?.item.weaponSpeed !== undefined;
		// Due to warrior HS bug, hit cap for crit cap calculation should be 8% instead of 27%
		const meleeHitCap = hasOffhandWeapon && this.getClass() != Class.ClassWarrior ? 27.0 : 7.5;
		const dodgeCap = 7.5;
		const parryCap = this.getInFrontOfTarget() ? 15.0 : 0;
		const expertiseCap = dodgeCap + parryCap;

		const remainingMeleeHitCap = Math.max(meleeHitCap - meleeHit, 0.0);
		const remainingDodgeCap = Math.max(dodgeCap - expertise, 0.0);
		const remainingParryCap = Math.max(parryCap - expertise, 0.0);
		const remainingExpertiseCap = remainingDodgeCap + remainingParryCap;

		const specSpecificOffset = 0.0;

		// if (this.getSpec() === Spec.SpecEnhancementShaman) {
		// 	// Elemental Devastation uptime is near 100%
		// 	// TODO: Cata - Check this
		// 	const ranks = (this as unknown as Player<Spec.SpecEnhancementShaman>).getTalents().elementalDevastation;
		// 	specSpecificOffset = 3.0 * ranks;
		// }

		const baseCritCap = 100.0 - glancing + suppression - remainingMeleeHitCap - remainingExpertiseCap - specSpecificOffset;
		const playerCritCapDelta = meleeCrit - baseCritCap;

		return {
			meleeCrit,
			meleeHit,
			expertise,
			suppression,
			glancing,
			hasOffhandWeapon,
			meleeHitCap,
			expertiseCap,
			remainingMeleeHitCap,
			remainingExpertiseCap,
			baseCritCap,
			specSpecificOffset,
			playerCritCapDelta,
		};
	}

	getMeleeCritCap() {
		return this.getMeleeCritCapInfo().playerCritCapDelta;
	}

	// In-place rotation mutation with a single change event — the write path for
	// the APL editor's per-field edits.
	modifyAplRotation(eventID: EventID, modify: (rotation: APLRotation) => void) {
		modify(this.aplRotation_);
		this.write({}, ['rotation']);
	}

	setAplRotation(eventID: EventID, newRotation: APLRotation) {
		if (APLRotation.equals(newRotation, this.aplRotation_)) return;

		this.aplRotation_ = APLRotation.clone(newRotation);
		this.write({}, ['rotation']);
	}

	getSimpleRotation(): SpecRotation<SpecType> {
		const jsonStr = this.aplRotation_.simple?.specRotationJson || '';
		if (!jsonStr) {
			return this.specTypeFunctions.rotationCreate();
		}

		try {
			const json = JSON.parse(jsonStr);
			return this.specTypeFunctions.rotationFromJson(json);
		} catch (e) {
			console.warn(`Error parsing rotation spec options: ${e}\n\nSpec options: '${jsonStr}'`);
			return this.specTypeFunctions.rotationCreate();
		}
	}

	setSimpleRotation(eventID: EventID, newRotation: SpecRotation<SpecType>) {
		if (this.specTypeFunctions.rotationEquals(newRotation, this.getSimpleRotation())) return;

		if (!this.aplRotation_.simple) {
			this.aplRotation_.simple = SimpleRotation.create();
		}
		this.aplRotation_.simple.specRotationJson = JSON.stringify(this.specTypeFunctions.rotationToJson(newRotation));

		this.write({}, ['rotation']);
	}

	getSimpleCooldowns(): Cooldowns {
		// Make a defensive copy
		return Cooldowns.clone(this.aplRotation_.simple?.cooldowns || Cooldowns.create());
	}

	setSimpleCooldowns(eventID: EventID, newCooldowns: Cooldowns) {
		if (Cooldowns.equals(this.getSimpleCooldowns(), newCooldowns)) return;

		if (!this.aplRotation_.simple) {
			this.aplRotation_.simple = SimpleRotation.create();
		}
		this.aplRotation_.simple.cooldowns = newCooldowns;
		this.write({}, ['rotation']);
	}

	getRotationType(): APLRotationType {
		if (this.aplRotation_.type == APLRotationType.TypeUnknown) {
			return APLRotationType.TypeAPL;
		} else {
			return this.aplRotation_.type;
		}
	}

	hasSimpleRotationGenerator(): boolean {
		return this.simpleRotationGenerator != null;
	}

	getResolvedAplRotation(forSimming?: boolean): APLRotation {
		const type = this.getRotationType();
		if (type == APLRotationType.TypeAuto && this.autoRotationGenerator) {
			// Clone to avoid modifying preset rotations, which are often returned directly.
			const rot = APLRotation.clone(this.autoRotationGenerator(this));
			rot.type = APLRotationType.TypeAuto;
			return rot;
		} else if (type == APLRotationType.TypeSimple && this.simpleRotationGenerator) {
			// Clone to avoid modifying preset rotations, which are often returned directly.
			const simpleRot = this.getSimpleRotation();
			const rot = APLRotation.clone(this.simpleRotationGenerator(this, simpleRot, this.getSimpleCooldowns()));
			rot.simple = this.aplRotation_.simple;
			rot.type = APLRotationType.TypeSimple;
			return rot;
		} else if (forSimming) {
			return this.aplRotation_;
		} else {
			return omitDeep(this.aplRotation_, ['uuid']);
		}
	}

	getTalents(): SpecTalents<SpecType> {
		if (this.talents == null) {
			this.talents = playerTalentStringToProto(this.playerSpec, this.getTalentsString()) as SpecTalents<SpecType>;
		}
		return this.talents!;
	}

	getTalentsString(): string {
		return this.slice().talentsString;
	}

	setTalentsString(eventID: EventID, newTalentsString: string) {
		if (newTalentsString == this.getTalentsString()) return;

		// Invalidate the parsed-talents cache before the emit fires.
		this.talents = null;
		this.patch('talentsString', newTalentsString);
	}

	getTalentTreePoints(): Array<number> {
		return getTalentTreePoints(this.getTalentsString());
	}

	getTalentTreeIcon(): string {
		return this.playerSpec.getIcon('medium');
	}

	getGlyphs(): Glyphs {
		// Make a defensive copy
		return Glyphs.clone(this.slice().glyphs);
	}

	setGlyphs(eventID: EventID, newGlyphs: Glyphs) {
		if (Glyphs.equals(this.slice().glyphs, newGlyphs)) return;

		// Make a defensive copy
		this.patch('glyphs', Glyphs.clone(newGlyphs));
	}

	getMajorGlyphs(): Array<number> {
		const glyphs = this.slice().glyphs;
		return [glyphs.major1, glyphs.major2, glyphs.major3].filter(glyph => glyph != 0);
	}

	getMinorGlyphs(): Array<number> {
		const glyphs = this.slice().glyphs;
		return [glyphs.minor1, glyphs.minor2, glyphs.minor3].filter(glyph => glyph != 0);
	}

	getAllGlyphs(): Array<number> {
		return this.getMajorGlyphs().concat(this.getMinorGlyphs());
	}

	getClassOptions(): ClassOptions<SpecType> {
		return this.getSpecOptions().classOptions as ClassOptions<SpecType>;
	}

	setClassOptions(eventID: EventID, newClassOptions: ClassOptions<SpecType>) {
		const newSpecOptions = this.getSpecOptions();
		newSpecOptions.classOptions = newClassOptions;
		if (this.specTypeFunctions.optionsEquals(newSpecOptions, this.slice().specOptions as SpecOptions<SpecType>)) return;

		this.patch('specOptions', this.specTypeFunctions.optionsCopy(newSpecOptions));
	}

	getSpecOptions(): SpecOptions<SpecType> {
		return this.specTypeFunctions.optionsCopy(this.slice().specOptions as SpecOptions<SpecType>);
	}

	setSpecOptions(eventID: EventID, newSpecOptions: SpecOptions<SpecType>) {
		if (this.specTypeFunctions.optionsEquals(newSpecOptions, this.slice().specOptions as SpecOptions<SpecType>)) return;

		this.patch('specOptions', this.specTypeFunctions.optionsCopy(newSpecOptions));
	}

	getReactionTime(): number {
		return this.slice().reactionTime;
	}

	setReactionTime(eventID: EventID, newReactionTime: number) {
		if (newReactionTime == this.getReactionTime()) return;

		this.patch('reactionTime', newReactionTime);
	}

	getChannelClipDelay(): number {
		return this.slice().channelClipDelay;
	}

	setChannelClipDelay(eventID: EventID, newChannelClipDelay: number) {
		if (newChannelClipDelay == this.getChannelClipDelay()) return;

		this.patch('channelClipDelay', newChannelClipDelay);
	}

	getChallengeModeEnabled(): boolean {
		return this.slice().challengeModeEnabled;
	}

	setChallengeModeEnabled(eventID: EventID, value: boolean) {
		if (value === this.getChallengeModeEnabled()) return;

		this.patch('challengeModeEnabled', value);
	}

	getInFrontOfTarget(): boolean {
		return this.slice().inFrontOfTarget;
	}

	setInFrontOfTarget(eventID: EventID, newInFrontOfTarget: boolean) {
		if (newInFrontOfTarget == this.getInFrontOfTarget()) return;

		this.patch('inFrontOfTarget', newInFrontOfTarget);
	}

	getDistanceFromTarget(): number {
		return this.slice().distanceFromTarget;
	}

	setDistanceFromTarget(eventID: EventID, newDistanceFromTarget: number) {
		if (newDistanceFromTarget == this.getDistanceFromTarget()) return;

		this.patch('distanceFromTarget', newDistanceFromTarget);
	}

	setDefaultHealingParams(hm: HealingModel) {
		const boss = this.sim.encounter.primaryTarget;
		const dualWield = boss.dualWield;
		if (hm.cadenceSeconds == 0) {
			let maxCadence = 1.5 * boss.swingSpeed;
			if (dualWield) {
				maxCadence /= 2;
			}
			hm.cadenceSeconds = 0.4;
			hm.cadenceVariation = maxCadence - hm.cadenceSeconds;
		}
		if (hm.hps == 0) {
			hm.hps = (0.25 * boss.minBaseDamage) / boss.swingSpeed;
			if (dualWield) {
				hm.hps *= 1.5;
			}
		}
	}

	enableHealing() {
		this.healingEnabled = true;
		const hm = this.getHealingModel();
		if (hm.cadenceSeconds == 0 || hm.hps == 0) {
			this.setDefaultHealingParams(hm);
			this.setHealingModel(0, hm);
		}
	}

	getHealingModel(): HealingModel {
		// Make a defensive copy
		return HealingModel.clone(this.slice().healingModel);
	}

	setHealingModel(eventID: EventID, newHealingModel: HealingModel) {
		if (HealingModel.equals(this.slice().healingModel, newHealingModel)) return;

		// Make a defensive copy
		const healingModel = HealingModel.clone(newHealingModel);
		// If we have enabled healing model and try to set 0s cadence or 0 incoming HPS, then set intelligent defaults instead based on boss parameters.
		if (this.healingEnabled) {
			this.setDefaultHealingParams(healingModel);
		}
		this.patch('healingModel', healingModel);
	}

	computeStatsEP(stats?: Stats): number {
		if (stats == undefined) {
			return 0;
		}
		return stats.computeEP(this.getEpWeights());
	}

	computeGemEP(gem: Gem): number {
		if (this.gemEPCache.has(gem.id)) {
			return this.gemEPCache.get(gem.id)!;
		}

		const epFromStats = this.computeStatsEP(new Stats(gem.stats));
		const epFromEffect = getMetaGemEffectEP(this.playerSpec, gem, Stats.fromProto(this.slice().currentStats.finalStats));
		let bonusEP = 0;
		// unique items are slightly worse than non-unique because you can have only one.
		if (gem.unique) {
			bonusEP -= 0.01;
		}

		const ep = epFromStats + epFromEffect + bonusEP;
		this.gemEPCache.set(gem.id, ep);
		return ep;
	}

	computeEnchantEP(enchant: Enchant): number {
		if (this.enchantEPCache.has(enchant.effectId)) {
			return this.enchantEPCache.get(enchant.effectId)!;
		}

		const ep = this.computeStatsEP(new Stats(enchant.stats));
		this.enchantEPCache.set(enchant.effectId, ep);
		return ep;
	}

	computeRandomSuffixEP(randomSuffix: ItemRandomSuffix): number {
		if (this.randomSuffixEPCache.has(randomSuffix.id)) {
			return this.randomSuffixEPCache.get(randomSuffix.id)!;
		}

		const ep = this.computeStatsEP(new Stats(randomSuffix.stats));
		this.randomSuffixEPCache.set(randomSuffix.id, ep);
		return ep;
	}

	computeReforgingEP(reforging: ReforgeData): number {
		let stats = new Stats([]);
		stats = stats.addStat(reforging.fromStat, reforging.fromAmount);
		stats = stats.addStat(reforging.toStat, reforging.toAmount);

		return this.computeStatsEP(stats);
	}

	computeUpgradeEP(equippedItem: EquippedItem, upgradeLevel: ItemLevelState, slot: ItemSlot): number {
		const cacheKey = `${equippedItem.id}-${JSON.stringify(this.getEpWeights())}-${slot}-${equippedItem.randomSuffix?.id}-${upgradeLevel}`;
		if (this.upgradeEPCache.has(cacheKey)) {
			return this.upgradeEPCache.get(cacheKey)!;
		}

		const stats = equippedItem.withUpgrade(upgradeLevel).withDynamicStats().calcStats(slot);
		const ep = this.computeStatsEP(stats);
		this.upgradeEPCache.set(cacheKey, ep);

		return ep;
	}

	computeItemEP(item: Item, slot: ItemSlot): number {
		if (item == null) return 0;

		const cacheKey = `${item.id}-${JSON.stringify(this.getEpWeights())}-${this.getChallengeModeEnabled()}`;

		const cached = this.itemEPCache[slot].get(cacheKey);
		if (cached !== undefined) return cached;

		const equippedItem = new EquippedItem({
			item,
			challengeMode: this.getChallengeModeEnabled(),
		}).withDynamicStats();
		const itemStats = equippedItem.calcStats(slot);

		// For random suffix items, use the suffix option with the highest EP for the purposes of ranking items in the picker.
		let maxSuffixEP = 0;
		if (item.randomSuffixOptions.length) {
			const suffixEPs = equippedItem.item.randomSuffixOptions.map(id => this.computeRandomSuffixEP(this.sim.db.getRandomSuffixById(id)! || 0));
			maxSuffixEP = (Math.max(...suffixEPs) * equippedItem.item.randPropPoints) / 10000;
		}

		let maxReforgingEP = 0;
		if (this.getAvailableReforgings(equippedItem).length) {
			const reforgingEPs = this.getAvailableReforgings(equippedItem).map(reforging => this.computeReforgingEP(reforging));
			maxReforgingEP = Math.max(...reforgingEPs);
		}

		let ep = itemStats.computeEP(this.getEpWeights()) + maxSuffixEP + maxReforgingEP;

		// unique items are slightly worse than non-unique because you can have only one.
		if (item.unique) {
			ep -= 0.01;
		}

		// Compare whether its better to match sockets + get socket bonus, or just use best gems.
		const bestGemEPNotMatchingSockets = sum(
			item.gemSockets.map(socketColor => {
				const gems = this.sim.db.getGems(socketColor).filter(gem => isUnrestrictedGem(gem, this.sim.getPhase()));
				if (gems.length > 0) {
					return Math.max(...gems.map(gem => this.computeGemEP(gem)));
				} else {
					return 0;
				}
			}),
		);

		const bestGemEPMatchingSockets =
			sum(
				item.gemSockets.map(socketColor => {
					const gems = this.sim.db
						.getGems(socketColor)
						.filter(gem => isUnrestrictedGem(gem, this.sim.getPhase()) && gemMatchesSocket(gem, socketColor));
					if (gems.length > 0) {
						return Math.max(...gems.map(gem => this.computeGemEP(gem)));
					} else {
						return 0;
					}
				}),
			) + this.computeStatsEP(new Stats(item.socketBonus));

		ep += Math.max(bestGemEPMatchingSockets, bestGemEPNotMatchingSockets);

		this.itemEPCache[slot].set(cacheKey, ep);
		return ep;
	}

	async setWowheadData(equippedItem: EquippedItem, elem: HTMLElement | HTMLElement[]) {
		const isBlacksmithing = this.hasProfession(Profession.Blacksmithing);
		const gemIds = equippedItem.gems.length ? equippedItem.curGems(isBlacksmithing).map(gem => (gem ? gem.id : 0)) : [];
		const enchantIds = [equippedItem.enchant?.effectId, equippedItem.tinker?.effectId].filter((id): id is number => id !== undefined);
		const elems = Array.isArray(elem) ? elem : [elem];
		equippedItem.asActionId().setWowheadDataset(elems, {
			gemIds,
			itemLevel: Number(equippedItem.ilvl),
			enchantIds: enchantIds,
			reforgeId: equippedItem.reforge?.id,
			randomEnchantmentId: equippedItem.randomSuffix?.id,
			setPieceIds: this.getGear()
				.asArray()
				.filter(ei => ei != null)
				.map(ei => ei!.item.id),
			hasExtraSocket: equippedItem.hasExtraSocket(isBlacksmithing),
			upgradeStep: equippedItem.upgrade,
		});

		elems.forEach(e => (e.dataset.whtticon = 'false'));
	}

	static ARMOR_SLOTS: Array<ItemSlot> = [
		ItemSlot.ItemSlotHead,
		ItemSlot.ItemSlotShoulder,
		ItemSlot.ItemSlotChest,
		ItemSlot.ItemSlotWrist,
		ItemSlot.ItemSlotHands,
		ItemSlot.ItemSlotLegs,
		ItemSlot.ItemSlotWaist,
		ItemSlot.ItemSlotFeet,
	];

	static WEAPON_SLOTS: Array<ItemSlot> = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand];

	static readonly DIFFICULTY_SRCS: Partial<Record<SourceFilterOption, DungeonDifficulty>> = {
		[SourceFilterOption.SourceDungeon]: DungeonDifficulty.DifficultyNormal,
		[SourceFilterOption.SourceDungeonH]: DungeonDifficulty.DifficultyHeroic,
		[SourceFilterOption.SourceRaidRF]: DungeonDifficulty.DifficultyRaid25RF,
		[SourceFilterOption.SourceRaid]: DungeonDifficulty.DifficultyRaid25,
		[SourceFilterOption.SourceRaidH]: DungeonDifficulty.DifficultyRaid25H,
		[SourceFilterOption.SourceRaidFlex]: DungeonDifficulty.DifficultyRaidFlex,
	};

	static readonly HEROIC_TO_NORMAL: Partial<Record<DungeonDifficulty, DungeonDifficulty>> = {
		[DungeonDifficulty.DifficultyHeroic]: DungeonDifficulty.DifficultyNormal,
		[DungeonDifficulty.DifficultyRaid10H]: DungeonDifficulty.DifficultyRaid10,
		[DungeonDifficulty.DifficultyRaid25H]: DungeonDifficulty.DifficultyRaid25,
	};

	static readonly RAID_IDS: Partial<Record<RaidFilterOption, number>> = {
		[RaidFilterOption.RaidMogushanVaults]: 6125,
		[RaidFilterOption.RaidHeartOfFear]: 6297,
		[RaidFilterOption.RaidTerraceOfEndlessSpring]: 6067,
		[RaidFilterOption.RaidThroneOfThunder]: 6622,
		[RaidFilterOption.RaidSiegeOfOrgrimmar]: 6738,
	};

	get armorSpecializationArmorType() {
		// We always pick the first entry since this is always the preffered armor type
		return this.playerClass.armorTypes[0];
	}

	hasArmorSpecializationBonus() {
		return [
			ItemSlot.ItemSlotHead,
			ItemSlot.ItemSlotShoulder,
			ItemSlot.ItemSlotChest,
			ItemSlot.ItemSlotWrist,
			ItemSlot.ItemSlotHands,
			ItemSlot.ItemSlotWaist,
			ItemSlot.ItemSlotLegs,
			ItemSlot.ItemSlotFeet,
		].some(itemSlot => {
			const item = this.getEquippedItem(itemSlot)?.item;
			if (!item) return false;
			const armorType = item.armorType;
			return armorType !== this.armorSpecializationArmorType;
		});
	}

	hasEotBPItemEquipped() {
		return [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].some(itemSlot => {
			const item = this.getEquippedItem(itemSlot)?.item;
			return !!item?.eotbGemSocket;
		});
	}

	filterItemData<T>(itemData: Array<T>, getItemFunc: (val: T) => Item, slot: ItemSlot): Array<T> {
		const filters = this.sim.getFilters();

		const filterItems = (itemData: Array<T>, filterFunc: (item: Item) => boolean) => {
			return itemData.filter(itemElem => filterFunc(getItemFunc(itemElem)));
		};

		if (filters.minIlvl != 0) {
			itemData = filterItems(itemData, item => (item.scalingOptions?.[ItemLevelState.Base].ilvl || item.ilvl) >= filters.minIlvl);
		}
		if (filters.maxIlvl != 0) {
			itemData = filterItems(itemData, item => (item.scalingOptions?.[ItemLevelState.Base].ilvl || item.ilvl) <= filters.maxIlvl);
		}

		if (filters.factionRestriction != UIItem_FactionRestriction.UNSPECIFIED) {
			itemData = filterItems(
				itemData,
				item => item.factionRestriction == filters.factionRestriction || item.factionRestriction == UIItem_FactionRestriction.UNSPECIFIED,
			);
		}

		if (!filters.sources.includes(SourceFilterOption.SourceSoldBy)) {
			itemData = filterItems(itemData, item => !item.sources.some(itemSrc => itemSrc.source.oneofKind == 'soldBy'));
		}
		if (!filters.sources.includes(SourceFilterOption.SourceCrafting)) {
			itemData = filterItems(itemData, item => !item.sources.some(itemSrc => itemSrc.source.oneofKind == 'crafted'));
		}
		if (!filters.sources.includes(SourceFilterOption.SourceQuest)) {
			itemData = filterItems(itemData, item => !item.sources.some(itemSrc => itemSrc.source.oneofKind == 'quest'));
		}
		if (!filters.sources.includes(SourceFilterOption.SourceReputation)) {
			itemData = filterItems(itemData, item => !item.sources.some(itemSrc => itemSrc.source.oneofKind == 'rep'));
		}
		if (!filters.sources.includes(SourceFilterOption.SourcePvp)) {
			itemData = filterItems(itemData, item => !isPVPItem(item));
		}

		for (const [srcOptionStr, difficulty] of Object.entries(Player.DIFFICULTY_SRCS)) {
			const srcOption = parseInt(srcOptionStr) as SourceFilterOption;

			if (!filters.sources.includes(srcOption)) {
				itemData = filterItems(
					itemData,
					item => !item.sources.some(itemSrc => itemSrc.source.oneofKind == 'drop' && itemSrc.source.drop.difficulty == difficulty),
				);

				if (difficulty == DungeonDifficulty.DifficultyRaid10H || difficulty == DungeonDifficulty.DifficultyRaid25H) {
					const normalDifficulty = Player.HEROIC_TO_NORMAL[difficulty];
					itemData = filterItems(
						itemData,
						item =>
							!item.sources.some(
								itemSrc =>
									itemSrc.source.oneofKind == 'drop' &&
									itemSrc.source.drop.difficulty == normalDifficulty &&
									itemSrc.source.drop.category == AL_CATEGORY_HARD_MODE,
							),
					);
				}
			}
		}

		for (const [raidOptionStr, zoneId] of Object.entries(Player.RAID_IDS)) {
			const raidOption = parseInt(raidOptionStr) as RaidFilterOption;
			if (!filters.raids.includes(raidOption)) {
				itemData = filterItems(
					itemData,
					item => !item.sources.some(itemSrc => itemSrc.source.oneofKind == 'drop' && itemSrc.source.drop.zoneId == zoneId),
				);
			}
		}

		if (Player.ARMOR_SLOTS.includes(slot)) {
			itemData = filterItems(itemData, item => {
				if (!filters.armorTypes.includes(item.armorType)) {
					return false;
				}

				return true;
			});
		} else if (Player.WEAPON_SLOTS.includes(slot)) {
			itemData = filterItems(itemData, item => {
				if (item.handType == HandType.HandTypeUnknown && item.rangedWeaponType == RangedWeaponType.RangedWeaponTypeUnknown) {
					return false;
				}

				if (!filters.weaponTypes.includes(item.weaponType) && item.handType > HandType.HandTypeUnknown) {
					return false;
				}

				if (!filters.oneHandedWeapons && item.handType != HandType.HandTypeTwoHand) {
					return false;
				}
				if (!filters.twoHandedWeapons && item.handType == HandType.HandTypeTwoHand) {
					return false;
				}

				// Ranged weapons are equiped in MH slot from MoP onwards
				if (!filters.rangedWeaponTypes.includes(item.rangedWeaponType) && item.rangedWeaponType > RangedWeaponType.RangedWeaponTypeUnknown) {
					return false;
				}

				let minSpeed = slot == ItemSlot.ItemSlotMainHand ? filters.minMhWeaponSpeed : filters.minOhWeaponSpeed;
				let maxSpeed = slot == ItemSlot.ItemSlotMainHand ? filters.maxMhWeaponSpeed : filters.maxOhWeaponSpeed;
				if (item.rangedWeaponType > 0) {
					minSpeed = filters.minRangedWeaponSpeed;
					maxSpeed = filters.maxRangedWeaponSpeed;
				}

				if (minSpeed > 0 && item.weaponSpeed < minSpeed) {
					return false;
				}
				if (maxSpeed > 0 && item.weaponSpeed > maxSpeed) {
					return false;
				}

				return true;
			});
		}

		return itemData;
	}

	filterEnchantData<T>(enchantData: Array<T>, getEnchantFunc: (val: T) => Enchant, slot: ItemSlot, currentEquippedItem: EquippedItem | null): Array<T> {
		if (!currentEquippedItem) {
			return enchantData;
		}

		//const filters = this.sim.getFilters();

		return enchantData.filter(enchantElem => {
			const enchant = getEnchantFunc(enchantElem);

			if (!enchantAppliesToItem(enchant, currentEquippedItem.item)) {
				return false;
			}

			return true;
		});
	}

	filterGemData<T>(gemData: Array<T>, getGemFunc: (val: T) => Gem, slot: ItemSlot, socketColor: GemColor): Array<T> {
		const filters = this.sim.getFilters();

		const isJewelcrafting = this.hasProfession(Profession.Jewelcrafting);
		return gemData.filter(gemElem => {
			const gem = getGemFunc(gemElem);
			if (!isJewelcrafting && gem.requiredProfession == Profession.Jewelcrafting) {
				return false;
			}

			if (filters.matchingGemsOnly && !gemMatchesSocket(gem, socketColor)) {
				return false;
			}

			// This is not exactly a player selected filter, just a general filter to remove any gems with stats that is not in use for the player.
			// i.e dead gems.
			const statsFilter = this.specConfig.gemStats ?? this.specConfig.epStats;
			const positiveStatIds = gem.stats.map((value, statId) => (value > 0 ? statId : -1)).filter(statId => statId >= 0);
			if (!positiveStatIds.length) {
				return false;
			}
			return !positiveStatIds.some(statId => !statsFilter.includes(statId));
		});
	}

	makeUnitReference(): UnitReference {
		if (this.party == null) {
			return emptyUnitReference();
		} else {
			return newUnitReference(this.getRaidIndex());
		}
	}

	private toDatabase(): SimDatabase {
		const dbGear = this.getGear().toDatabase(this.sim.db);
		const dbItemSwapGear = this.itemSwapSettings.getGear().toDatabase(this.sim.db);
		return Database.mergeSimDatabases(dbGear, dbItemSwapGear);
	}

	toProto(forExport?: boolean, forSimming?: boolean, exportCategories?: Array<SimSettingCategories>): PlayerProto {
		const exportCategory = (cat: SimSettingCategories) => !exportCategories || exportCategories.length == 0 || exportCategories.includes(cat);

		const gear = this.getGear();
		const aplRotation = forSimming ? this.getResolvedAplRotation(forSimming) : omitDeep(this.aplRotation_, ['uuid']);

		let player = PlayerProto.create({
			class: this.getClass(),
			database: forExport ? undefined : this.toDatabase(),
		});
		if (exportCategory(SimSettingCategories.Gear)) {
			PlayerProto.mergePartial(player, {
				equipment: gear.asSpec(),
				bonusStats: this.getBonusStats().toProto(),
				enableItemSwap: this.itemSwapSettings.getEnableItemSwap(),
				itemSwap: this.itemSwapSettings.toProto(),
			});
		}
		if (exportCategory(SimSettingCategories.Talents)) {
			PlayerProto.mergePartial(player, {
				talentsString: this.getTalentsString(),
				glyphs: this.getGlyphs(),
			});
		}
		if (exportCategory(SimSettingCategories.Rotation)) {
			PlayerProto.mergePartial(player, {
				cooldowns: Cooldowns.create({
					hpPercentForDefensives: this.getSimpleCooldowns().hpPercentForDefensives,
				}),
				rotation: aplRotation,
			});
		}
		if (exportCategory(SimSettingCategories.Consumes)) {
			PlayerProto.mergePartial(player, {
				consumables: this.getConsumes(forSimming),
			});
		}
		if (exportCategory(SimSettingCategories.Miscellaneous)) {
			PlayerProto.mergePartial(player, {
				name: this.getName(),
				race: this.getRace(),
				profession1: this.getProfession1(),
				profession2: this.getProfession2(),
				reactionTimeMs: this.getReactionTime(),
				channelClipDelayMs: this.getChannelClipDelay(),
				inFrontOfTarget: this.getInFrontOfTarget(),
				distanceFromTarget: this.getDistanceFromTarget(),
				healingModel: this.getHealingModel(),
				challengeMode: this.getChallengeModeEnabled(),
			});
			player = withSpec(this.getSpec(), player, this.getSpecOptions());
		}
		if (exportCategory(SimSettingCategories.External)) {
			PlayerProto.mergePartial(player, {
				buffs: this.getBuffs(),
			});
		}
		return player;
	}

	fromProto(eventID: EventID, proto: PlayerProto, includeCategories?: Array<SimSettingCategories>) {
		// Fix potential out-of-date protos before importing
		batch(() => {
			Player.updateProtoVersion(proto);
			const loadCategory = (cat: SimSettingCategories) => !includeCategories || includeCategories.length == 0 || includeCategories.includes(cat);
			eventID = nextEventID();
			if (loadCategory(SimSettingCategories.Gear)) {
				this.setGear(eventID, proto.equipment ? this.sim.db.lookupEquipmentSpec(proto.equipment) : new Gear({}));
				this.itemSwapSettings.setItemSwapSettings(
					eventID,
					proto.enableItemSwap,
					proto.itemSwap ? this.sim.db.lookupItemSwap(proto.itemSwap) : new ItemSwapGear({}),
					Stats.fromProto(proto.itemSwap?.prepullBonusStats),
				);
				this.setBonusStats(eventID, Stats.fromProto(proto.bonusStats || UnitStats.create()));
				//this.setBulkEquipmentSpec(eventID, BulkEquipmentSpec.create()); // Do not persist the bulk equipment settings.
			}
			if (loadCategory(SimSettingCategories.Talents)) {
				this.setTalentsString(eventID, proto.talentsString);
				this.setGlyphs(eventID, proto.glyphs || Glyphs.create());
			}
			if (loadCategory(SimSettingCategories.Rotation)) {
				if (proto.rotation?.type == APLRotationType.TypeUnknown) {
					if (!proto.rotation) {
						proto.rotation = APLRotation.create();
					}
					proto.rotation.type = APLRotationType.TypeAuto;
				}
				this.setAplRotation(eventID, proto.rotation || APLRotation.create());
			}
			if (loadCategory(SimSettingCategories.Consumes)) {
				this.setConsumes(eventID, proto.consumables || ConsumesSpec.create());
			}
			if (loadCategory(SimSettingCategories.Miscellaneous)) {
				this.setSpecOptions(eventID, this.specTypeFunctions.optionsFromPlayer(proto));
				this.setName(eventID, proto.name);
				this.setRace(eventID, proto.race);
				this.setProfession1(eventID, proto.profession1);
				this.setProfession2(eventID, proto.profession2);
				this.setReactionTime(eventID, proto.reactionTimeMs);
				this.setChannelClipDelay(eventID, proto.channelClipDelayMs);
				this.setInFrontOfTarget(eventID, proto.inFrontOfTarget);
				this.setDistanceFromTarget(eventID, proto.distanceFromTarget);
				this.setHealingModel(eventID, proto.healingModel || HealingModel.create());
				this.setChallengeModeEnabled(eventID, proto.challengeMode);
			}
			if (loadCategory(SimSettingCategories.External)) {
				this.setBuffs(eventID, proto.buffs || IndividualBuffs.create());
			}
		});
	}

	clone(eventID: EventID): Player<SpecType> {
		const newPlayer = new Player<SpecType>(this.playerSpec, this.sim);
		newPlayer.fromProto(eventID, this.toProto());
		return newPlayer;
	}

	applySharedDefaults(eventID: EventID) {
		batch(() => {
			this.setReactionTime(eventID, 100);
			this.setInFrontOfTarget(eventID, this.playerSpec.isTankSpec);
			this.setHealingModel(
				eventID,
				HealingModel.create({
					burstWindow: this.playerSpec.isTankSpec ? 6 : 0,
				}),
			);
			this.setSimpleCooldowns(
				eventID,
				Cooldowns.create({
					hpPercentForDefensives: this.playerSpec.isTankSpec ? 0.4 : 0,
				}),
			);
			this.setBonusStats(eventID, new Stats());
		});
	}

	getBaseMastery(): number {
		return 8;
	}

	getMasteryPerPointModifier(): number {
		return Mechanics.masteryPercentPerPoint.get(this.getSpec()) || 0;
	}
	static updateProtoVersion(proto: PlayerProto) {
		if (!(proto.apiVersion < CURRENT_API_VERSION)) {
			return;
		}
	}

	getSpecConfig(): SpecConfigData<SpecType> {
		return this.specConfig;
	}

	// Returns true/false for main-hand / off-hand
	getActiveRacialExpertiseBonuses(): [boolean, boolean] {
		const mainHand = this.getEquippedItem(ItemSlot.ItemSlotMainHand);
		const offHand = this.getEquippedItem(ItemSlot.ItemSlotOffHand);

		if (!mainHand && !offHand) {
			return [false, false];
		}

		switch (this.getRace()) {
			case Race.RaceDwarf:
				return [
					mainHand?.item.weaponType === WeaponType.WeaponTypeMace ||
						mainHand?.item.rangedWeaponType === RangedWeaponType.RangedWeaponTypeBow ||
						mainHand?.item.rangedWeaponType === RangedWeaponType.RangedWeaponTypeCrossbow ||
						mainHand?.item.rangedWeaponType === RangedWeaponType.RangedWeaponTypeGun,
					offHand?.item.weaponType === WeaponType.WeaponTypeMace,
				];
			case Race.RaceGnome:
				return [
					mainHand?.item.weaponType === WeaponType.WeaponTypeDagger ||
						(mainHand?.item.handType !== HandType.HandTypeTwoHand && mainHand?.item.weaponType === WeaponType.WeaponTypeSword),
					offHand?.item.weaponType === WeaponType.WeaponTypeDagger ||
						(offHand?.item.handType !== HandType.HandTypeTwoHand && offHand?.item.weaponType === WeaponType.WeaponTypeSword),
				];
			case Race.RaceHuman:
				return [
					mainHand?.item.weaponType === WeaponType.WeaponTypeMace || mainHand?.item.weaponType === WeaponType.WeaponTypeSword,
					offHand?.item.weaponType === WeaponType.WeaponTypeMace || offHand?.item.weaponType === WeaponType.WeaponTypeSword,
				];
			case Race.RaceOrc:
				return [
					mainHand?.item.weaponType === WeaponType.WeaponTypeAxe || mainHand?.item.weaponType === WeaponType.WeaponTypeFist,
					offHand?.item.weaponType === WeaponType.WeaponTypeAxe || offHand?.item.weaponType === WeaponType.WeaponTypeFist,
				];
			case Race.RaceTroll:
				return [
					mainHand?.item.rangedWeaponType === RangedWeaponType.RangedWeaponTypeBow ||
						mainHand?.item.rangedWeaponType === RangedWeaponType.RangedWeaponTypeCrossbow ||
						mainHand?.item.rangedWeaponType === RangedWeaponType.RangedWeaponTypeGun,
					false,
				];
		}

		return [false, false];
	}

	getAmplificationTrinkets() {
		return [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2]
			.map(itemSlot => {
				const item = this.getEquippedItem(itemSlot);
				if (!item || !['Prismatic Prison of Pride', 'Purified Bindings of Immerseus', "Thok's Tail Tip"].includes(item.item.name)) return null;
				return item;
			})
			.filter((i): i is EquippedItem => !!i);
	}

	getTotalAmplificationTrinketStatModifier() {
		const trinkets = this.getAmplificationTrinkets();
		let totalModifier = 1;
		for (const trinket of trinkets) {
			// The amp percentage uses a float budget curve, not the integer
			// RandPropPoints table — mirrors GetItemEffectAmpScaling in
			// sim/core/utils.go (fitted against in-game sheets at 463-580).
			const budget = 22.78695 * Math.exp(0.00932545 * trinket.ilvl);
			const statScalingCoeff = 0.00176999997;
			const buffValue = 1 + (statScalingCoeff * budget) / 100;
			totalModifier *= buffValue;
		}
		return totalModifier;
	}
}
