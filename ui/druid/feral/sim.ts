import * as OtherInputs from '../../core/components/inputs/other_inputs';
import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import { ReforgeOptimizer, RelativeStatCap } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLAction, APLListItem, APLPrepullAction, APLRotation, APLRotation_Type as APLRotationType } from '../../core/proto/apl';
import { Cooldowns, Debuffs, Faction, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import {
	FeralDruid_Rotation as DruidRotation,
	FeralDruid_Rotation_AplType as FeralRotationType,
	FeralDruid_Rotation_HotwStrategy as HotwStrategy,
} from '../../core/proto/druid';
import * as AplUtils from '../../core/proto_utils/apl_utils';
import { Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import { TypedEvent } from '../../core/typed_event';
import * as FeralInputs from './inputs';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecFeralDruid, {
	cssClass: 'feral-druid-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Druid),
	// Override required talent rows - Feral only requires rows 3 and 5 instead of all rows
	requiredTalentRows: [0, 3, 5],
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	warnings: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStrength,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatHitRating,
		Stat.StatExpertiseRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatAgility,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatStrength, Stat.StatAgility, Stat.StatAttackPower, Stat.StatExpertiseRating, Stat.StatMasteryRating, Stat.StatMana],
		[PseudoStat.PseudoStatPhysicalHitPercent, PseudoStat.PseudoStatPhysicalCritPercent, PseudoStat.PseudoStatMeleeHastePercent],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.PRERAID_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.DOC_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

			return hitCap.add(expCap);
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default rotation settings.
		rotationType: APLRotationType.TypeSimple,
		simpleRotation: Presets.DefaultRotation,
		// Default talents.
		talents: Presets.StandardTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(),
			markOfTheWild: true,
			trueshotAura: true,
			unholyAura: true,
			graceOfAir: true,
			bloodlust: true,
			arcaneBrilliance: true,
			moonkinAura: true,
		}),
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			weakenedArmor: true,
			physicalVulnerability: true,
			lightningBreath: true,
		}),
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Inputs to include in the 'Rotation' section on the settings tab.
	rotationInputs: FeralInputs.FeralDruidRotationConfig,
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.SpellPowerBuff, BuffDebuffInputs.SpellDamageDebuff, BuffDebuffInputs.SpellHasteBuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			FeralInputs.AssumeBleedActive,
			OtherInputs.InputDelay,
			OtherInputs.DistanceFromTarget,
			OtherInputs.TankAssignment,
			OtherInputs.InFrontOfTarget,
			FeralInputs.CannotShredTarget,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.DOC_EP_PRESET, Presets.HOTW_EP_PRESET, Presets.DOC_RORO_PRESET, Presets.HOTW_RORO_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.StandardTalents, Presets.HotWTalents],
		rotations: [Presets.SIMPLE_ROTATION_DEFAULT, Presets.APL_ROTATION_DEFAULT],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P1_PRESET, Presets.P2_PRESET, Presets.P3_PRESET],
		itemSwaps: [Presets.ITEM_SWAP_PRESET],
		builds: [Presets.PRESET_BUILD_ST, Presets.PRESET_BUILD_CLEAVE],
	},

	autoRotation: (_player: Player<Spec.SpecFeralDruid>): APLRotation => {
		return Presets.APL_ROTATION_DEFAULT.rotation.rotation!;
	},

	simpleRotation: (player: Player<Spec.SpecFeralDruid>, simple: DruidRotation, cooldowns: Cooldowns): APLRotation => {
		const [prepullActions, actions] = AplUtils.standardCooldownDefaults(cooldowns);

		// Rotation entries
		const agiTrinkets = APLAction.fromJsonString(
			`{"condition":{"or":{"vals":[{"auraIsActive":{"auraId":{"spellId":5217}}},{"cmp":{"op":"OpLt","lhs":{"remainingTime":{}},"rhs":{"const":{"val":"16s"}}}}]}},"castAllStatBuffCooldowns":{"statType1":1,"statType2":-1,"statType3":-1}}`,
		);
		const synapseSprings = APLAction.fromJsonString(
			`{"condition":{"or":{"vals":[{"auraIsActive":{"auraId":{"spellId":5217}}},{"cmp":{"op":"OpLt","lhs":{"remainingTime":{}},"rhs":{"const":{"val":"11s"}}}}]}},"castSpell":{"spellId":{"spellId":126734}}}`,
		);
		const hasteTrinkets = APLAction.fromJsonString(
			`{"condition":{"or":{"vals":[{"auraIsActive":{"auraId":{"spellId":5217}}},{"cmp":{"op":"OpLt","lhs":{"remainingTime":{}},"rhs":{"const":{"val":"16s"}}}}]}},"castAllStatBuffCooldowns":{"statType1":7,"statType2":-1,"statType3":-1}}`,
		);
		const trees = APLAction.fromJsonString(
			`{"condition":{"or":{"vals":[{"anyStatBuffCooldownsActive":{"statType1":1,"statType2":-1,"statType3":-1}},{"and":{"vals":[{"cmp":{"op":"OpEq","lhs":{"numStatBuffCooldowns":{"statType1":1,"statType2":-1,"statType3":-1}},"rhs":{"const":{"val":"0"}}}},{"anyTrinketStatProcsActive":{"statType1":1,"statType2":-1,"statType3":-1,"minIcdSeconds":30}}]}},{"cmp":{"op":"OpLt","lhs":{"remainingTime":{}},"rhs":{"const":{"val":"16s"}}}}]}},"castSpell":{"spellId":{"spellId":106737}}}`,
		);
		const potion = APLAction.fromJsonString(
			`{"condition":{"or":{"vals":[{"and":{"vals":[{"auraIsActive":{"auraId":{"spellId":5217}}},{"cmp":{"op":"OpLt","lhs":{"remainingTime":{}},"rhs":{"math":{"op":"OpAdd","lhs":{"spellTimeToReady":{"spellId":{"spellId":106952}}},"rhs":{"const":{"val":"26s"}}}}}}]}},{"cmp":{"op":"OpLt","lhs":{"remainingTime":{}},"rhs":{"const":{"val":"26s"}}}},{"auraIsActive":{"auraId":{"spellId":106951}}}]}},"castSpell":{"spellId":{"itemId":76089}}}`,
		);
		const trollRacial = APLAction.fromJsonString(`{"condition":{"auraIsActive":{"auraId":{"spellId":106951}}},"castSpell":{"spellId":{"spellId":26297}}}`);
		const blockZerk = APLAction.fromJsonString(`{"condition":{"const":{"val":"false"}},"castSpell":{"spellId":{"spellId":106952}}}`);
		const blockNS = APLAction.fromJsonString(`{"condition":{"const":{"val":"false"}},"castSpell":{"spellId":{"spellId":132158}}}`);
		const blockHotw = APLAction.fromJsonString(`{"condition":{"const":{"val":"false"}},"castSpell":{"spellId":{"spellId":108292}}}`);
		const shouldUseHotw = player.getTalents().heartOfTheWild && simple.hotwStrategy != HotwStrategy.PassivesOnly;
		const shouldWrathWeave = shouldUseHotw && simple.hotwStrategy == HotwStrategy.Wrath;
		const doRotation = APLAction.fromJsonString(
			`{"catOptimalRotationAction":{"rotationType":${simple.rotationType},"manualParams":${simple.manualParams},"allowAoeBerserk":${simple.allowAoeBerserk},"bearWeave":${simple.bearWeave},"snekWeave":${simple.snekWeave},"useNs":${simple.useNs},"wrathWeave":${shouldWrathWeave},"minRoarOffset":${simple.minRoarOffset.toFixed(2)},"ripLeeway":${simple.ripLeeway.toFixed(2)},"useBite":${simple.useBite},"biteTime":${simple.biteTime.toFixed(2)},"berserkBiteTime":${simple.berserkBiteTime.toFixed(2)}}}`,
		);

		const singleTarget = simple.rotationType == FeralRotationType.SingleTarget;
		actions.push(
			...([
				singleTarget ? agiTrinkets : null,
				singleTarget ? synapseSprings : null,
				singleTarget ? hasteTrinkets : null,
				singleTarget ? trees : null,
				singleTarget ? potion : null,
				singleTarget ? trollRacial : null,
				blockZerk,
				blockNS,
				!shouldUseHotw ? blockHotw : null,
				doRotation,
			].filter(a => a) as Array<APLAction>),
		);

		// Pre-pull entries
		const healingTouch = APLPrepullAction.fromJsonString(`{"action":{"castSpell":{"spellId":{"spellId":5185}}},"doAtValue":{"const":{"val":"-5.2s"}}}`);
		const shiftCat = APLPrepullAction.fromJsonString(`{"action":{"castSpell":{"spellId":{"spellId":768}}},"doAtValue":{"const":{"val":"-2.6s"}}}`);
		const preRoar = APLPrepullAction.fromJsonString(`{"action":{"castSpell":{"spellId":{"spellId":52610}}},"doAtValue":{"const":{"val":"-1s"}}}`);

		prepullActions.push(
			...([
				player.getTalents().dreamOfCenarius ? healingTouch : null,
				player.getTalents().dreamOfCenarius ? shiftCat : null,
				player.getMajorGlyphs().includes(40923) ? preRoar : null,
			].filter(a => a) as Array<APLPrepullAction>),
		);

		return APLRotation.create({
			prepullActions: prepullActions,
			priorityList: actions.map(action =>
				APLListItem.create({
					action: action,
				}),
			),
		});
	},

	hiddenMCDs: [126734, 106737, 76089, 26297, 106952, 132158, 108292, 55004],

	raidSimPresets: [
		{
			spec: Spec.SpecFeralDruid,
			talents: Presets.StandardTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceNightElf,
				[Faction.Horde]: Race.RaceTauren,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P1_PRESET.gear,
					2: Presets.P2_PRESET.gear,
					3: Presets.P3_PRESET.gear,
					4: Presets.P4_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.P1_PRESET.gear,
					2: Presets.P2_PRESET.gear,
					3: Presets.P3_PRESET.gear,
					4: Presets.P4_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
});

export class FeralDruidSimUI extends IndividualSimUI<Spec.SpecFeralDruid> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecFeralDruid>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			getEPDefaults: (player: Player<Spec.SpecFeralDruid>) => {
				if (player.getTalents().heartOfTheWild) {
					return RelativeStatCap.hasRoRo(player) ? Presets.HOTW_RORO_PRESET.epWeights : Presets.HOTW_EP_PRESET.epWeights;
				} else {
					return RelativeStatCap.hasRoRo(player) ? Presets.DOC_RORO_PRESET.epWeights : Presets.DOC_EP_PRESET.epWeights;
				}
			},
			defaultRelativeStatCap: Stat.StatMasteryRating,
		});
	}
}
