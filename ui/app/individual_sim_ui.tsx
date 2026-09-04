import { SimSettingCategories } from '@domain/constants/sim_settings';
import { isDevMode } from '@domain/env';
import { Player } from '@domain/player';
import { PlayerSpecs } from '@domain/player_specs';
import { armorTypeNames, professionNames } from '@domain/proto_utils/names';
import { pseudoStatHasCap, StatCap, Stats } from '@domain/proto_utils/stats';
import { getTalentPoints } from '@domain/proto_utils/utils';
import { StatWeightActionSettings } from '@domain/stat_weight_settings';
import { batch } from '@domain/state/batch';
import { loadIndividualSettings } from '@domain/state/persistence';
import {
	applyIndividualSimSettings,
	IndividualSimSerializationContext,
	individualSimSettingsToProto,
	updateIndividualSimProtoVersion,
} from '@domain/state/serialization';
import { subscribeAll, subscribePlayerField, subscribeReforgeChange, subscribeSimChange } from '@domain/state/subscriptions';
import { getMissingTalentRows, getRequiredTalentRows, hasRequiredTalents } from '@domain/talents/requirements';
import { BulkTab } from '@features/bulk/view/bulk_tab';
import { CharacterStats } from '@features/character-stats/view/character_stats';
import { ItemNotice } from '@features/gear/view/item_notice';
import {
	// Individual60UEPExporter,
	IndividualCLIExporter,
	IndividualJsonExporter,
	IndividualLinkExporter,
	IndividualPawnEPExporter,
	IndividualWowheadGearPlannerExporter,
} from '@features/import-export/view/exporters';
import { LogExporter } from '@features/import-export/view/exporters/detailed_log_exporter';
import {
	// Individual60UImporter,
	IndividualAddonImporter,
	IndividualJsonImporter,
	IndividualWowheadGearPlannerImporter,
} from '@features/import-export/view/importers';
import { ReforgeOptimizer } from '@features/reforge/view/reforge_panel';
import { DetailedResults } from '@features/results/view/detailed_results';
import { addSimResultsAction, SimResultsManager } from '@features/results/view/results_action';
import * as OtherInputs from '@features/settings/model/other_inputs';
import type { IndividualSimHost } from '@features/sim_host';
import type { SpecDefinition } from '@features/spec_config';
import { IndividualSimUIConfig, itemSwapEnabledSpecs } from '@features/spec_config';
import { addStatWeightsAction, EpWeightsMenu } from '@features/stat-weights/view/stat_weights_panel';
import { StatWeightsResult } from '@generated/proto/api';
import { APLRotation, APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { Cooldowns, Glyphs, HandType, ItemSlot, ItemSwap, Profession, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';

import { PresetConfigurationPicker } from './preset_configuration_picker';
import { SimUI } from './sim_ui';
import { GearTab } from './tabs/gear_tab';
import { RotationTab } from './tabs/rotation_tab';
import { SettingsTab } from './tabs/settings_tab';
import { TalentsTab } from './tabs/talents_tab';

export type {
	CustomSection,
	DerivedSetting,
	IndividualSimUIConfig,
	InputConfig,
	InputSection,
	OtherDefaults,
	Settings,
	SpecBehaviors,
	SpecDefinition,
} from '@features/spec_config';
export { defineSpec, itemSwapEnabledSpecs, registerSpecConfig } from '@features/spec_config';
const SAVED_GEAR_STORAGE_KEY = '__savedGear__';
const SAVED_EP_WEIGHTS_STORAGE_KEY = '__savedEPWeights__';
const SAVED_ROTATION_STORAGE_KEY = '__savedRotation__';
const SAVED_SETTINGS_STORAGE_KEY = '__savedSettings__';
const SAVED_TALENTS_STORAGE_KEY = '__savedTalents__';

// Extended shared UI for all individual player sims.
export class IndividualSimUI<SpecType extends Spec> extends SimUI implements IndividualSimHost<SpecType> {
	readonly player: Player<SpecType>;
	readonly individualConfig: IndividualSimUIConfig<SpecType>;
	private readonly statWeightActionSettings: StatWeightActionSettings;

	raidSimResultsManager: SimResultsManager | null;
	epWeightsModal: EpWeightsMenu | null = null;

	prevEpIterations: number;
	prevEpSimResult: StatWeightsResult | null;
	get dpsRefStat(): Stat | undefined {
		return this.player.getRefStat('dpsRefStat');
	}
	set dpsRefStat(v: Stat | undefined) {
		this.player.setRefStat('dpsRefStat', v);
	}
	get healRefStat(): Stat | undefined {
		return this.player.getRefStat('healRefStat');
	}
	set healRefStat(v: Stat | undefined) {
		this.player.setRefStat('healRefStat', v);
	}
	get tankRefStat(): Stat | undefined {
		return this.player.getRefStat('tankRefStat');
	}
	set tankRefStat(v: Stat | undefined) {
		this.player.setRefStat('tankRefStat', v);
	}

	private serializationContext(): IndividualSimSerializationContext {
		return {
			player: this.player,
			sim: this.sim,
			reforgeSettings: this.reforger?.settings,
			defaultEpWeights: this.individualConfig.defaults.epWeights,
		};
	}

	readonly bt: BulkTab | null = null;
	reforger: ReforgeOptimizer | null = null;

	constructor(parentElem: HTMLElement, player: Player<SpecType>, config: SpecDefinition<SpecType>) {
		super(parentElem, player.sim, {
			cssClass: config.cssClass,
			cssScheme: config.cssScheme,
			spec: player.getPlayerSpec(),
			knownIssues: config.knownIssues,
			simStatus: player.getPlayerSpec().launch,
		});
		this.rootElem.classList.add('individual-sim-ui');
		this.player = player;
		this.individualConfig = this.applyDefaultConfigOptions(config);
		this.raidSimResultsManager = null;
		this.prevEpIterations = 0;
		this.prevEpSimResult = null;
		this.statWeightActionSettings = new StatWeightActionSettings(this.player, this.getStorageKey('__statweight_settings__'));

		if ((config.itemSwapSlots || []).length > 0 && !itemSwapEnabledSpecs.includes(player.getSpec())) {
			itemSwapEnabledSpecs.push(player.getSpec());
		}

		this.addWarning({
			updateOn: subscribeAll([
				subscribePlayerField(this.player, 'gear'),
				subscribePlayerField(this.player, 'profession1'),
				subscribePlayerField(this.player, 'profession2'),
			]),
			getContent: () => {
				const failedProfReqs = this.player.getGear().getFailedProfessionRequirements(this.player.getProfessions());
				if (failedProfReqs.length == 0) {
					return '';
				}

				return failedProfReqs.map(fpr =>
					i18n.t('sidebar.warnings.profession_requirement', {
						itemName: fpr.name,
						professionName: professionNames.get(fpr.requiredProfession)!,
					}),
				);
			},
		});
		this.addWarning({
			updateOn: subscribePlayerField(this.player, 'gear'),
			getContent: () => {
				const jcGems = this.player.getGear().getJCGems(this.player.isBlacksmithing());
				if (jcGems.length <= 2) {
					return '';
				}

				return i18n.t('sidebar.warnings.too_many_jc_gems', {
					count: jcGems.length,
				});
			},
		});
		this.addWarning({
			updateOn: subscribePlayerField(this.player, 'talentsString'),
			getContent: () => {
				const talentPoints = getTalentPoints(this.player.getTalentsString());
				const requiredRows = getRequiredTalentRows(this.individualConfig);

				// Only skip warning during initial load if there are no required talents
				if (talentPoints == 0 && requiredRows.length == 0) {
					return '';
				} else if (!hasRequiredTalents(this.individualConfig, this.player.getTalentsString())) {
					const missingRows = getMissingTalentRows(this.individualConfig, this.player.getTalentsString());
					const missingRowNumbers = missingRows.map(row => row + 1).join(', ');
					return i18n.t('sidebar.warnings.unspent_talent_points', {
						rowNumbers: missingRowNumbers,
					});
				} else {
					return '';
				}
			},
		});
		this.addWarning({
			updateOn: subscribePlayerField(this.player, 'gear'),
			getContent: () => {
				if (!this.player.armorSpecializationArmorType) {
					return '';
				}

				if (this.player.hasArmorSpecializationBonus()) {
					return i18n.t('sidebar.warnings.armor_specialization', {
						armorType: armorTypeNames.get(this.player.armorSpecializationArmorType),
					});
				} else {
					return '';
				}
			},
		});
		this.addWarning({
			updateOn: subscribeAll([subscribePlayerField(this.player, 'gear'), subscribePlayerField(this.player, 'talentsString')]),
			getContent: () => {
				if (
					!this.player.canDualWield2H() &&
					((this.player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType == HandType.HandTypeTwoHand &&
						this.player.getEquippedItem(ItemSlot.ItemSlotOffHand) != null) ||
						this.player.getEquippedItem(ItemSlot.ItemSlotOffHand)?.item.handType == HandType.HandTypeTwoHand)
				) {
					return i18n.t('sidebar.warnings.dual_wield_2h_without_titans_grip');
				} else {
					return '';
				}
			},
		});
		(config.warnings || []).forEach(warning => this.addWarning(warning(this)));

		// This needs to go before all the UI components so that gear loading is the
		// first callback invoked from waitForInit().
		this.sim.waitForInit().then(() => {
			ItemNotice.registerSetBonusNotices(this.sim.db);
			this.loadSettings();

			if (this.player.getPlayerSpec().isHealingSpec && !isDevMode()) {
				alert(i18n.t('sim.healing_sim_disclaimer'));
			}
		});

		this.addSidebarComponents();
		this.addGearTab();
		this.addSettingsTab();
		this.addTalentsTab();
		this.addRotationTab();

		this.addDetailedResultsTab();

		this.bt = this.addBulkTab();

		this.sim.waitForInit().then(() => {
			this.addTopbarComponents();
		});

		// Declarative behaviour slots. These run last, exactly where a spec
		// subclass' constructor body used to run: after every tab and sidebar
		// component exists, but still synchronously, so `loadSettings()` (queued
		// on waitForInit above) already sees `this.reforger`.
		if (config.reforge) {
			this.reforger = new ReforgeOptimizer(this, typeof config.reforge === 'function' ? config.reforge(this) : config.reforge);
		}
		for (const derived of config.derivedSettings || []) {
			derived.apply(this.player, this.sim);
			derived.subscribe(this.player, this.sim)(() => derived.apply(this.player, this.sim));
		}
		for (const feature of config.features || []) {
			feature(this);
		}
	}

	applyDefaultConfigOptions(config: IndividualSimUIConfig<SpecType>): IndividualSimUIConfig<SpecType> {
		config.otherInputs.inputs = [OtherInputs.ChallengeMode, ...config.otherInputs.inputs];

		return config;
	}

	private loadSettings() {
		// Autosave sources: the sim aggregate (settings + raid + encounter, no
		// server-derived state) plus the reforge settings.
		const autosaveSubscribe = this.reforger
			? subscribeAll([subscribeSimChange(this.sim), subscribeReforgeChange(this.reforger.settings)])
			: subscribeSimChange(this.sim);
		loadIndividualSettings(this, {
			storageKey: this.getSettingsStorageKey(),
			player: this.player,
			autosaveSubscribe,
			statWeightSettings: this.statWeightActionSettings,
		});
	}

	private addSidebarComponents() {
		this.raidSimResultsManager = addSimResultsAction(this);
		this.sim.waitForInit().then(() => {
			this.epWeightsModal = addStatWeightsAction(this, this.statWeightActionSettings);
		});

		new CharacterStats(
			this.rootElem.querySelector('.sim-sidebar-stats') as HTMLElement,
			this,
			this.player,
			this.individualConfig.displayStats,
			this.individualConfig.modifyDisplayStats,
			this.individualConfig.overwriteDisplayStats,
		);
	}

	private addGearTab() {
		const gearTab = new GearTab(this.simTabContentsContainer, this);
		gearTab.rootElem.classList.add('active', 'show');
	}

	private addBulkTab(): BulkTab {
		const bulkTab = new BulkTab(this.simTabContentsContainer, this);
		//bulkTab.navLink.hidden = !this.sim.getShowExperimental();
		//this.sim.showExperimentalChangeEmitter.on(() => {
		//	bulkTab.navLink.hidden = !this.sim.getShowExperimental();
		//});
		return bulkTab;
	}

	private addSettingsTab() {
		new SettingsTab(this.simTabContentsContainer, this);
	}

	private addTalentsTab() {
		new TalentsTab(this.simTabContentsContainer, this);
	}

	private addRotationTab() {
		new RotationTab(this.simTabContentsContainer, this);
	}

	private addDetailedResultsTab() {
		const detailedResults = (<div className="detailed-results"></div>) as HTMLElement;
		this.addTab(i18n.t('results_tab.title'), 'detailed-results-tab', detailedResults);

		new DetailedResults(detailedResults, this, this.raidSimResultsManager!, getLogData => new LogExporter(this.rootElem, this, getLogData));
	}

	private addTopbarComponents() {
		this.simHeader.addImportLink('JSON', new IndividualJsonImporter(this.rootElem, this));
		// this.simHeader.addImportLink('60U Cata', new Individual60UImporter(this.rootElem, this));
		this.simHeader.addImportLink('WoWHead', new IndividualWowheadGearPlannerImporter(this.rootElem, this));
		this.simHeader.addImportLink('Addon', new IndividualAddonImporter(this.rootElem, this));

		this.simHeader.addExportLink('Link', new IndividualLinkExporter(this.rootElem, this));
		this.simHeader.addExportLink('JSON', new IndividualJsonExporter(this.rootElem, this));
		this.simHeader.addExportLink('WoWHead', new IndividualWowheadGearPlannerExporter(this.rootElem, this));
		// this.simHeader.addExportLink('60U Cata EP', new Individual60UEPExporter(this.rootElem, this));
		this.simHeader.addExportLink('Pawn EP', new IndividualPawnEPExporter(this.rootElem, this));
		this.simHeader.addExportLink('CLI', new IndividualCLIExporter(this.rootElem, this));
	}

	applyDefaultRotation() {
		batch(() => {
			const defaultRotationType = this.individualConfig.defaults.rotationType || APLRotationType.TypeAuto;
			this.player.setAplRotation(
				APLRotation.create({
					type: defaultRotationType,
				}),
			);

			if (!this.individualConfig.defaults.simpleRotation) {
				return;
			}

			const defaultSimpleRotation = this.individualConfig.defaults.simpleRotation || this.player.specTypeFunctions.rotationCreate();
			this.player.setSimpleRotation(defaultSimpleRotation);
			this.player.setSimpleCooldowns(
				Cooldowns.create({
					hpPercentForDefensives: this.player.playerSpec.isTankSpec ? 0.4 : 0,
				}),
			);
		});
	}

	applyEmptyAplRotation() {
		batch(() => {
			this.player.setAplRotation(
				APLRotation.create({
					type: APLRotationType.TypeAPL,
				}),
			);
		});
	}

	static updateProtoVersion(settingsProto: IndividualSimSettings) {
		updateIndividualSimProtoVersion(settingsProto);
	}

	applyDefaults() {
		batch(() => {
			const tankSpec = this.player.getPlayerSpec().isTankSpec;
			const healingSpec = this.player.getPlayerSpec().isHealingSpec;

			this.player.applySharedDefaults();
			this.player.setRace(this.individualConfig.defaults.other?.race || this.player.getPlayerClass().races[0]);
			this.player.setGear(this.sim.db.lookupEquipmentSpec(this.individualConfig.defaults.gear));
			this.player.setConsumes(this.individualConfig.defaults.consumables);
			this.applyDefaultRotation();
			this.player.setTalentsString(this.individualConfig.defaults.talents.talentsString);
			this.player.setGlyphs(this.individualConfig.defaults.talents.glyphs || Glyphs.create());
			this.player.setSpecOptions(this.individualConfig.defaults.specOptions);
			this.player.setBuffs(this.individualConfig.defaults.individualBuffs);
			this.player.getParty()!.setBuffs(this.individualConfig.defaults.partyBuffs);
			this.player.getRaid()!.setBuffs(this.individualConfig.defaults.raidBuffs);
			this.player.setEpWeights(this.individualConfig.defaults.epWeights);
			if (this.individualConfig.defaults.itemSwap) {
				this.player.itemSwapSettings.setItemSwapSettings(
					true,
					this.sim.db.lookupItemSwap(this.individualConfig.defaults.itemSwap || ItemSwap.create()),
				);
			}

			const defaultRatios = this.player.getDefaultEpRatios(tankSpec, healingSpec);
			this.player.setEpRatios(defaultRatios);
			this.player.setProfession1(this.individualConfig.defaults.other?.profession1 || Profession.Engineering);

			if (this.individualConfig.defaults.other?.profession2 === undefined) {
				this.player.setProfession2(Profession.Jewelcrafting);
			} else {
				this.player.setProfession2(this.individualConfig.defaults.other.profession2);
			}

			this.player.setDistanceFromTarget(this.individualConfig.defaults.other?.distanceFromTarget || 0);
			this.player.setChannelClipDelay(this.individualConfig.defaults.other?.channelClipDelay || 0);
			this.player.setReactionTime(this.individualConfig.defaults.other?.reactionTime || 100);

			this.reforger?.applyDefaults();

			this.sim.raid.setTargetDummies(healingSpec ? 9 : 0);
			if (this.individualConfig.defaults.encounter?.encounter) {
				this.sim.encounter.fromProto(this.individualConfig.defaults.encounter.encounter);
			} else {
				this.sim.encounter.applyDefaults();
			}
			this.sim.encounter.setExecuteProportion90(this.individualConfig.defaults.other?.highHpThreshold || 0.9);
			this.sim.raid.setDebuffs(this.individualConfig.defaults.debuffs);
			this.sim.applyDefaults(tankSpec, healingSpec);

			if (this.individualConfig.defaults.other?.iterationCount) {
				this.sim.setIterations(this.individualConfig.defaults.other!.iterationCount!);
			}

			if (tankSpec) {
				this.sim.raid.setTanks([this.player.makeUnitReference()]);
			} else {
				this.sim.raid.setTanks([]);
			}

			this.statWeightActionSettings.applyDefaults();

			if (this.individualConfig.defaultBuild) {
				PresetConfigurationPicker.applyBuild(this.individualConfig.defaultBuild, this);
			}
		});
	}

	toProto(exportCategories?: Array<SimSettingCategories>): IndividualSimSettings {
		return individualSimSettingsToProto(this.serializationContext(), exportCategories);
	}

	toLink(): string {
		return IndividualLinkExporter.createLink(this);
	}

	fromProto(settings: IndividualSimSettings, includeCategories?: Array<SimSettingCategories>) {
		applyIndividualSimSettings(this.serializationContext(), settings, includeCategories);
	}

	// Determines whether this sim has either a hard cap or soft cap configured for a particular
	// PseudoStat. Used by the stat weights code to ensure that school-specific EPs are calculated for
	// Rating stats whenever school-specific caps are present.
	hasCapForPseudoStat(pseudoStat: PseudoStat): boolean {
		// Check both default and currently stored hard caps.
		const defaultHardCaps = this.individualConfig.defaults.statCaps || new Stats();
		const currentHardCaps = this.reforger?.statCaps || new Stats();

		// Also check all configured soft caps
		const defaultSoftCaps: StatCap[] = this.individualConfig.defaults.softCapBreakpoints || [];

		return pseudoStatHasCap(pseudoStat, currentHardCaps.add(defaultHardCaps), defaultSoftCaps);
	}

	// Determines whether a particular PseudoStat has been configured as a
	// display stat for this sim UI.
	hasDisplayPseudoStat(pseudoStat: PseudoStat): boolean {
		for (const unitStat of this.individualConfig.displayStats) {
			if (unitStat.equalsPseudoStat(pseudoStat)) {
				return true;
			}
		}

		return false;
	}

	getSavedGearStorageKey(): string {
		return this.getStorageKey(SAVED_GEAR_STORAGE_KEY);
	}

	getSavedEPWeightsStorageKey(): string {
		return this.getStorageKey(SAVED_EP_WEIGHTS_STORAGE_KEY);
	}

	getSavedRotationStorageKey(): string {
		return this.getStorageKey(SAVED_ROTATION_STORAGE_KEY);
	}

	getSavedSettingsStorageKey(): string {
		return this.getStorageKey(SAVED_SETTINGS_STORAGE_KEY);
	}

	getSavedTalentsStorageKey(): string {
		return this.getStorageKey(SAVED_TALENTS_STORAGE_KEY);
	}

	// Returns the actual key to use for local storage, based on the given key part and the site context.
	// Local storage is shared by all sites under the same domain, so each spec
	// site prefixes its keys.
	getStorageKey(keyPart: string): string {
		return PlayerSpecs.getLocalStorageKey(this.player.getPlayerSpec()) + keyPart;
	}
}
