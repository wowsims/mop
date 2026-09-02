import { IndividualSimUI } from '@core/individual_sim_ui';
import { InputType, MobType, Spec, SpellSchool, Stat, Target, Target as TargetProto, TargetInput } from '@core/proto/common';
import { SimUI } from '@core/sim_ui';
import { Encounter } from '@domain/encounter';
import { Stats } from '@domain/proto_utils/stats';
import { Raid } from '@domain/raid';
import { EventID, nextEventID } from '@domain/state/batch';
import {
	subscribeAll,
	subscribeEncounterChange,
	subscribeEncounterField,
	subscribePlayerChange,
	subscribePlayerField,
	subscribeRaidField,
} from '@domain/state/subscriptions';
import { randomUUID } from '@domain/utils';
import i18n from '@i18n/config';
import { translateMobType, translateSpellSchool, translateStat, translateTargetInputLabel, translateTargetInputTooltip } from '@i18n/localization';
import { BaseModal } from '@ui-kit/base_modal';
import { Component } from '@ui-kit/component';
import { Input } from '@ui-kit/input';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import { EnumPicker } from '@ui-kit/pickers/enum_picker';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';
import { NumberPicker } from '@ui-kit/pickers/number_picker';

import { trackEvent, TrackEventProps } from '../../../tracking/utils';
export interface EncounterPickerConfig {
	showExecuteProportion: boolean;
}

export class EncounterPicker extends Component {
	constructor(parent: HTMLElement, modEncounter: Encounter, config: EncounterPickerConfig, simUI: SimUI) {
		super(parent, 'encounter-picker-root');

		addEncounterFieldPickers(this.rootElem, modEncounter, config.showExecuteProportion);

		// Need to wait so that the encounter and target presets will be loaded.
		modEncounter.sim.waitForInit().then(() => {
			const presetTargets = modEncounter.sim.db.getAllPresetTargets();

			// new EnumPicker<Encounter>(this.rootElem, modEncounter, {
			// 	extraCssClasses: ['damage-metrics', 'npc-picker'],
			// 	label: 'NPC',
			// 	labelTooltip: 'Selects a preset NPC configuration.',
			// 	values: [{ name: 'Custom', value: -1 }].concat(
			// 		presetTargets.map((pe, i) => {
			// 			return {
			// 				name: pe.path,
			// 				value: i,
			// 			};
			// 		}),
			// 	),
			// 	changedEvent: (encounter: Encounter) => encounter.changeEmitter,
			// 	getValue: (encounter: Encounter) => presetTargets.findIndex(pe => equalTargetsIgnoreInputs(encounter.primaryTarget, pe.target)),
			// 	setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
			// 		if (newValue != -1) {
			// 			encounter.applyPresetTarget(eventID, presetTargets[newValue], 0);
			// 		}
			// 	},
			// });

			const presetEncounters = modEncounter.sim.db.getAllPresetEncounters();
			new EnumPicker<Encounter>(this.rootElem, modEncounter, {
				id: 'encounter-preset-encouter',
				label: i18n.t('settings_tab.encounter.encounter_preset.label'),
				//extraCssClasses: ['encounter-picker', 'mb-0', 'pe-2', 'order-first'],
				extraCssClasses: ['damage-metrics', 'npc-picker'],
				values: [{ name: i18n.t('common.custom'), value: -1 }].concat(
					presetEncounters.map((pe, i) => {
						return {
							name: pe.path,
							value: i,
						};
					}),
				),
				storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
				getValue: (encounter: Encounter) => presetEncounters.findIndex(pe => encounter.matchesPreset(pe)),
				setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
					if (newValue != -1) {
						encounter.applyPreset(eventID, presetEncounters[newValue]);
					}
				},
			});

			//new EnumPicker<Encounter>(this.rootElem, modEncounter, {
			//	label: 'Target Level',
			//	values: [
			//		{ name: '83', value: 83 },
			//		{ name: '82', value: 82 },
			//		{ name: '81', value: 81 },
			//		{ name: '80', value: 80 },
			//	],
			//	changedEvent: (encounter: Encounter) => encounter.changeEmitter,
			//	getValue: (encounter: Encounter) => encounter.primaryTarget.getLevel(),
			//	setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
			//		encounter.primaryTarget.setLevel(eventID, newValue);
			//	},
			//});

			//new EnumPicker(this.rootElem, modEncounter, {
			//	label: 'Mob Type',
			//	values: mobTypeEnumValues,
			//	changedEvent: (encounter: Encounter) => encounter.changeEmitter,
			//	getValue: (encounter: Encounter) => encounter.primaryTarget.getMobType(),
			//	setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
			//		encounter.primaryTarget.setMobType(eventID, newValue);
			//	},
			//});

			// Leaving this commented in case we want it later. But it takes up a lot of
			// screen space and none of these fields get changed much.
			//if (config.simpleTargetStats) {
			//	config.simpleTargetStats.forEach(stat => {
			//		new NumberPicker(this.rootElem, modEncounter, {
			//			label: statNames[stat],
			//			changedEvent: (encounter: Encounter) => encounter.changeEmitter,
			//			getValue: (encounter: Encounter) => encounter.primaryTarget.getStats().getStat(stat),
			//			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
			//				encounter.primaryTarget.setStats(eventID, encounter.primaryTarget.getStats().withStat(stat, newValue));
			//			},
			//		});
			//	});
			//}

			if (simUI.isIndividualSim() && (simUI as IndividualSimUI<any>).player.canEnableTargetDummies()) {
				const player = (simUI as IndividualSimUI<any>).player;
				new NumberPicker(this.rootElem, simUI.sim.raid, {
					id: 'encounter-num-allies',
					label: i18n.t('settings_tab.encounter.num_allies.label'),
					labelTooltip: i18n.t('settings_tab.encounter.num_allies.tooltip'),
					storeSubscribe: (raid: Raid) => subscribeAll([subscribeRaidField(raid, 'targetDummies'), subscribePlayerField(player, 'itemSwap')]),
					getValue: (raid: Raid) => raid.getTargetDummies(),
					setValue: (eventID: EventID, raid: Raid, newValue: number) => {
						raid.setTargetDummies(eventID, newValue);
					},
					showWhen: () => {
						if ([Spec.SpecBrewmasterMonk, Spec.SpecWindwalkerMonk].includes(player.getSpec())) {
							return false;
						}

						return player.shouldEnableTargetDummies();
					},
				});
				// Reset the dummy count when the setting stops applying (previously a
				// side effect inside showWhen).
				subscribePlayerChange(player)(() => {
					if (!player.shouldEnableTargetDummies() && simUI.sim.raid.getTargetDummies() != 0) {
						simUI.sim.raid.setTargetDummies(nextEventID(), 0);
					}
				});
			}

			if (simUI.isIndividualSim() && (simUI as IndividualSimUI<any>).player.getPlayerSpec().isTankSpec) {
				new NumberPicker(this.rootElem, modEncounter, {
					id: 'encounter-min-base-damage',
					label: i18n.t('settings_tab.encounter.min_base_damage.label'),
					labelTooltip: i18n.t('settings_tab.encounter.min_base_damage.tooltip'),
					storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
					getValue: (encounter: Encounter) => encounter.primaryTarget.minBaseDamage,
					setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
						encounter.modifyTarget(eventID, 0, target => {
							target.minBaseDamage = newValue;
						});
					},
				});
			}

			// Transfer Target Inputs from target Id if they dont match (possible when custom AI is selected)
			const targetIndex = presetTargets.findIndex(pe => modEncounter.primaryTarget.id == pe.target?.id);
			const targetInputs = presetTargets[targetIndex]?.target?.targetInputs || [];
			if (
				targetInputs.length != modEncounter.primaryTarget.targetInputs.length ||
				modEncounter.primaryTarget.targetInputs.some((ti, i) => ti.label != targetInputs[i].label)
			) {
				modEncounter.modifyTarget(nextEventID(), 0, target => {
					target.targetInputs = targetInputs;
				});
			}

			makeTargetInputsPicker(this.rootElem, modEncounter, 0);

			const advancedModal = new AdvancedEncounterModal(simUI.rootElem, simUI, modEncounter);
			const advancedButton = document.createElement('button');
			advancedButton.classList.add('advanced-button', 'btn', 'btn-primary');
			advancedButton.textContent = i18n.t('settings_tab.encounter.advanced');
			advancedButton.addEventListener('click', () => advancedModal.open());
			this.rootElem.appendChild(advancedButton);
		});
	}
}

class AdvancedEncounterModal extends BaseModal {
	private readonly encounter: Encounter;

	constructor(parent: HTMLElement, simUI: SimUI, encounter: Encounter) {
		super(parent, 'advanced-encounter-picker-modal', { disposeOnClose: false });

		this.encounter = encounter;

		this.addHeader();
		this.body.innerHTML = `
			<div class="encounter-header"></div>
			<div class="encounter-targets"></div>
		`;

		const header = this.rootElem.getElementsByClassName('encounter-header')[0] as HTMLElement;
		const targetsElem = this.rootElem.getElementsByClassName('encounter-targets')[0] as HTMLElement;

		addEncounterFieldPickers(header, this.encounter, true);
		if (!simUI.isIndividualSim()) {
			new BooleanPicker<Encounter>(header, encounter, {
				id: 'aem-use-health',
				label: i18n.t('settings_tab.encounter.use_health.label'),
				labelTooltip: i18n.t('settings_tab.encounter.use_health.tooltip'),
				inline: true,
				storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
				getValue: (encounter: Encounter) => encounter.getUseHealth(),
				setValue: (eventID: EventID, encounter: Encounter, newValue: boolean) => {
					encounter.setUseHealth(eventID, newValue);
				},
			});
		}
		new ListPicker<Encounter, TargetProto>(targetsElem, this.encounter, {
			extraCssClasses: ['targets-picker', 'mb-0'],
			itemLabel: i18n.t('settings_tab.encounter.target'),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterField(encounter, 'targets'),
			getValue: (encounter: Encounter) => encounter.getTargets().slice(),
			setValue: (eventID: EventID, encounter: Encounter, newValue: Array<TargetProto>) => {
				trackEvent({
					action: 'settings',
					category: 'encounter',
					label: newValue.length > encounter.getTargets().length ? 'add-target' : 'remove-target',
				});
				encounter.setTargets(eventID, newValue);
			},
			newItem: () => Encounter.defaultTargetProto(),
			copyItem: (oldItem: TargetProto) => TargetProto.clone(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Encounter, TargetProto>,
				index: number,
				config: ListItemPickerConfig<Encounter, TargetProto>,
			) => new TargetPicker(parent, encounter, index, config),
			minimumItems: 1,
		});
	}

	private addHeader() {
		const presetEncounters = this.encounter.sim.db.getAllPresetEncounters();

		new EnumPicker<Encounter>(this.header as HTMLElement, this.encounter, {
			id: 'aem-encounter-picker',
			label: i18n.t('settings_tab.encounter.encounter_preset.label'),
			extraCssClasses: ['encounter-picker', 'mb-0', 'pe-2', 'order-first'],
			values: [{ name: 'Custom', value: -1 }].concat(
				presetEncounters.map((pe, i) => {
					return {
						name: pe.path,
						value: i,
					};
				}),
			),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
			getValue: (encounter: Encounter) => presetEncounters.findIndex(pe => encounter.matchesPreset(pe)),
			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
				if (newValue != -1) {
					const preset = presetEncounters[newValue];
					trackEvent({
						action: 'settings',
						category: 'encounter',
						label: 'preset',
						value: preset.path,
					});
					encounter.applyPreset(eventID, preset);
				}
			},
		});
	}
}

class TargetPicker extends Input<Encounter, TargetProto> {
	private readonly encounter: Encounter;
	private readonly targetIndex: number;
	private readonly aiPicker: Input<null, number>;
	private readonly levelPicker: Input<null, number>;
	private readonly mobTypePicker: Input<null, number>;
	private readonly tankIndexPicker: Input<null, number>;
	private readonly statPickers: Array<Input<null, number>>;
	private readonly swingSpeedPicker: Input<null, number>;
	private readonly minBaseDamagePicker: Input<null, number>;
	private readonly dualWieldPicker: Input<null, boolean>;
	private readonly dwMissPenaltyPicker: Input<null, boolean>;
	private readonly parryHastePicker: Input<null, boolean>;
	private readonly spellSchoolPicker: Input<null, number>;
	private readonly damageSpreadPicker: Input<null, number>;
	private readonly targetInputPickers: ListPicker<Encounter, TargetInput>;

	private getTarget(): TargetProto {
		return this.encounter.getTarget(this.targetIndex) || Target.create();
	}

	constructor(parent: HTMLElement, encounter: Encounter, targetIndex: number, config: ListItemPickerConfig<Encounter, TargetProto>) {
		super(parent, 'target-picker-root', encounter, config);
		this.encounter = encounter;
		this.targetIndex = targetIndex;

		this.rootElem.innerHTML = `
			<div class="picker-group target-picker-section target-picker-section1"></div>
			<div class="picker-group target-picker-section target-picker-section2"></div>
			<div class="picker-group target-picker-section target-picker-section3 threat-metrics"></div>
		`;

		const section1 = this.rootElem.querySelector<HTMLElement>('.target-picker-section1')!;
		const section2 = this.rootElem.querySelector<HTMLElement>('.target-picker-section2')!;
		const section3 = this.rootElem.querySelector<HTMLElement>('.target-picker-section3')!;

		const presetTargets = encounter.sim.db.getAllPresetTargets();
		new EnumPicker<null>(section1, null, {
			id: 'target-picker-npc',
			extraCssClasses: ['npc-picker'],
			label: i18n.t('settings_tab.encounter.npc.label'),
			labelTooltip: i18n.t('settings_tab.encounter.npc.tooltip'),
			values: [{ name: i18n.t('common.custom'), value: -1 }].concat(
				presetTargets.map((pe, i) => {
					return {
						name: pe.path,
						value: i,
					};
				}),
			),
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => presetTargets.findIndex(pe => equalTargetsIgnoreInputs(this.getTarget(), pe.target)),
			setValue: (eventID: EventID, _: null, newValue: number) => {
				if (newValue != -1) {
					const preset = presetTargets[newValue];
					trackEvent({
						action: 'settings',
						category: 'targets',
						label: 'preset',
						value: preset.target?.name || preset.path,
					});
					encounter.applyPresetTarget(eventID, preset, this.targetIndex);
				}
			},
		});

		this.aiPicker = new EnumPicker<null>(section1, null, {
			id: 'target-picker-ai',
			extraCssClasses: ['ai-picker'],
			label: i18n.t('settings_tab.encounter.ai.label'),
			labelTooltip: i18n.t('settings_tab.encounter.ai.tooltip'),
			values: [{ name: i18n.t('common.none'), value: 0 }].concat(
				presetTargets.map(pe => {
					return {
						name: pe.path,
						value: pe.target!.id,
					};
				}),
			),
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().id,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.id = newValue;
					trackEvent({
						action: 'settings',
						category: 'targets',
						label: 'ai',
						value: target.name,
					});

					// Transfer Target Inputs from the AI of the selected target
					target.targetInputs = (presetTargets.find(pe => target.id == pe.target?.id)?.target?.targetInputs || []).map(ti => TargetInput.clone(ti));
				});
			},
		});

		this.levelPicker = new EnumPicker<null>(section1, null, {
			id: 'target-picker-level',
			label: i18n.t('settings_tab.encounter.level'),
			values: [
				{ name: '93', value: 93 },
				{ name: '92', value: 92 },
				{ name: '91', value: 91 },
				{ name: '90', value: 90 },
				{ name: '88', value: 88 },
			],
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().level,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'level',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.level = newValue;
				});
			},
		});
		this.mobTypePicker = new EnumPicker(section1, null, {
			id: 'target-picker-mob-type',
			label: i18n.t('settings_tab.encounter.mob_type'),
			values: mobTypeEnumValues,
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().mobType,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'mob_type',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.mobType = newValue;
				});
			},
		});
		this.tankIndexPicker = new EnumPicker<null>(section1, null, {
			id: 'target-picker-tanked-by',
			extraCssClasses: ['threat-metrics'],
			label: i18n.t('settings_tab.encounter.tanked_by.label'),
			labelTooltip: i18n.t('settings_tab.encounter.tanked_by.tooltip'),
			values: [
				{ name: i18n.t('common.none'), value: -1 },
				{ name: i18n.t('common.tanks.main_tank'), value: 0 },
				{ name: i18n.t('common.tanks.tank_2'), value: 1 },
				{ name: i18n.t('common.tanks.tank_3'), value: 2 },
				{ name: i18n.t('common.tanks.tank_4'), value: 3 },
			],
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().tankIndex,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'tank_index',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.tankIndex = newValue;
				});
			},
		});

		this.targetInputPickers = makeTargetInputsPicker(section1, encounter, this.targetIndex);

		this.statPickers = ALL_TARGET_STATS.map(statData => {
			const stat = statData.stat;
			return new NumberPicker(section2, null, {
				id: `target-${this.targetIndex}-picker-stats-${statData.stat}`,
				inline: true,
				extraCssClasses: statData.extraCssClasses,
				label: translateStat(stat),
				labelTooltip: statData.tooltip,
				storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
				getValue: () => this.getTarget().stats[stat],
				setValue: (eventID: EventID, _: null, newValue: number) => {
					encounter.modifyTarget(eventID, this.targetIndex, target => {
						target.stats[stat] = newValue;
					});
				},
			});
		});

		this.swingSpeedPicker = new NumberPicker(section3, null, {
			id: `target-${this.targetIndex}-picker-swing-speed`,
			label: i18n.t('settings_tab.encounter.swing_speed.label'),
			labelTooltip: i18n.t('settings_tab.encounter.swing_speed.tooltip'),
			float: true,
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().swingSpeed,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'swing_speed',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.swingSpeed = newValue;
				});
			},
		});
		this.minBaseDamagePicker = new NumberPicker(section3, null, {
			id: `target-${this.targetIndex}-picker-min-base-damage`,
			label: i18n.t('settings_tab.encounter.min_base_damage.label'),
			labelTooltip: i18n.t('settings_tab.encounter.min_base_damage.tooltip'),
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().minBaseDamage,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'min_base_damage',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.minBaseDamage = newValue;
				});
			},
		});
		this.damageSpreadPicker = new NumberPicker(section3, null, {
			id: `target-${this.targetIndex}-picker-damage-spread`,
			label: i18n.t('settings_tab.encounter.damage_spread.label'),
			labelTooltip: i18n.t('settings_tab.encounter.damage_spread.tooltip'),
			float: true,
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().damageSpread,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'damage_spread',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.damageSpread = newValue;
				});
			},
		});
		this.dualWieldPicker = new BooleanPicker(section3, null, {
			id: `target-${this.targetIndex}-picker-dual-wield`,
			label: i18n.t('settings_tab.encounter.dual_wield.label'),
			labelTooltip: i18n.t('settings_tab.encounter.dual_wield.tooltip'),
			inline: true,
			reverse: true,
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().dualWield,
			setValue: (eventID: EventID, _: null, newValue: boolean) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'dual_wield',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.dualWield = newValue;
				});
			},
		});
		this.dwMissPenaltyPicker = new BooleanPicker(section3, null, {
			id: `target-${this.targetIndex}-picker-dw-miss-penalty`,
			label: i18n.t('settings_tab.encounter.dual_wield_penalty.label'),
			labelTooltip: i18n.t('settings_tab.encounter.dual_wield_penalty.tooltip'),
			inline: true,
			reverse: true,
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().dualWieldPenalty,
			setValue: (eventID: EventID, _: null, newValue: boolean) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'dual_wield_penalty',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.dualWieldPenalty = newValue;
				});
			},
			enableWhen: () => this.getTarget().dualWield,
		});
		this.parryHastePicker = new BooleanPicker(section3, null, {
			id: `target-${this.targetIndex}-picker-parry-haste`,
			label: i18n.t('settings_tab.encounter.parry_haste.label'),
			labelTooltip: i18n.t('settings_tab.encounter.parry_haste.tooltip'),
			inline: true,
			reverse: true,
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().parryHaste,
			setValue: (eventID: EventID, _: null, newValue: boolean) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'parry_haste',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.parryHaste = newValue;
				});
			},
		});
		this.spellSchoolPicker = new EnumPicker<null>(section3, null, {
			id: `target-${this.targetIndex}-picker-spell-school`,
			label: i18n.t('settings_tab.encounter.spell_school.label'),
			labelTooltip: i18n.t('settings_tab.encounter.spell_school.tooltip'),
			values: [
				{ name: translateSpellSchool(SpellSchool.SpellSchoolPhysical), value: SpellSchool.SpellSchoolPhysical },
				{ name: translateSpellSchool(SpellSchool.SpellSchoolArcane), value: SpellSchool.SpellSchoolArcane },
				{ name: translateSpellSchool(SpellSchool.SpellSchoolFire), value: SpellSchool.SpellSchoolFire },
				{ name: translateSpellSchool(SpellSchool.SpellSchoolFrost), value: SpellSchool.SpellSchoolFrost },
				{ name: translateSpellSchool(SpellSchool.SpellSchoolHoly), value: SpellSchool.SpellSchoolHoly },
				{ name: translateSpellSchool(SpellSchool.SpellSchoolNature), value: SpellSchool.SpellSchoolNature },
				{ name: translateSpellSchool(SpellSchool.SpellSchoolShadow), value: SpellSchool.SpellSchoolShadow },
			],
			storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
			getValue: () => this.getTarget().spellSchool,
			setValue: (eventID: EventID, _: null, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'targets',
					label: 'spell_school',
					value: newValue,
				});
				encounter.modifyTarget(eventID, this.targetIndex, target => {
					target.spellSchool = newValue;
				});
			},
		});

		this.init();
	}

	getInputElem(): HTMLElement | null {
		return null;
	}
	getInputValue(): TargetProto {
		return TargetProto.create({
			id: this.aiPicker.getInputValue(),
			level: this.levelPicker.getInputValue(),
			mobType: this.mobTypePicker.getInputValue(),
			tankIndex: this.tankIndexPicker.getInputValue(),
			swingSpeed: this.swingSpeedPicker.getInputValue(),
			minBaseDamage: this.minBaseDamagePicker.getInputValue(),
			dualWield: this.dualWieldPicker.getInputValue(),
			dualWieldPenalty: this.dwMissPenaltyPicker.getInputValue(),
			parryHaste: this.parryHastePicker.getInputValue(),
			spellSchool: this.spellSchoolPicker.getInputValue(),
			damageSpread: this.damageSpreadPicker.getInputValue(),
			stats: this.statPickers
				.map(picker => picker.getInputValue())
				.map((statValue, i) => new Stats().withStat(ALL_TARGET_STATS[i].stat, statValue))
				.reduce((totalStats, curStats) => totalStats.add(curStats))
				.asProtoArray(),
			targetInputs: this.targetInputPickers.getInputValue(),
		});
	}
	setInputValue(newValue: TargetProto) {
		if (!newValue) {
			return;
		}
		this.aiPicker.setInputValue(newValue.id);
		this.levelPicker.setInputValue(newValue.level);
		this.mobTypePicker.setInputValue(newValue.mobType);
		this.tankIndexPicker.setInputValue(newValue.tankIndex);
		this.swingSpeedPicker.setInputValue(newValue.swingSpeed);
		this.minBaseDamagePicker.setInputValue(newValue.minBaseDamage);
		this.dualWieldPicker.setInputValue(newValue.dualWield);
		this.dwMissPenaltyPicker.setInputValue(newValue.dualWieldPenalty);
		this.parryHastePicker.setInputValue(newValue.parryHaste);
		this.spellSchoolPicker.setInputValue(newValue.spellSchool);
		this.damageSpreadPicker.setInputValue(newValue.damageSpread);
		ALL_TARGET_STATS.forEach((statData, i) => this.statPickers[i].setInputValue(newValue.stats[statData.stat]));
		this.targetInputPickers.setInputValue(newValue.targetInputs);
	}
}

class TargetInputPicker extends Input<Encounter, TargetInput> {
	private readonly encounter: Encounter;
	private readonly targetIndex: number;
	private readonly targetInputIndex: number;

	private boolPicker: Input<null, boolean> | null;
	private numberPicker: Input<null, number> | null;
	private enumPicker: EnumPicker<null> | null;

	private getTargetInput(): TargetInput {
		return this.encounter.getTarget(this.targetIndex)!.targetInputs[this.targetInputIndex] || TargetInput.create();
	}

	private clearPickers() {
		if (this.boolPicker) {
			this.boolPicker.rootElem.remove();
			this.boolPicker = null;
		}
		if (this.numberPicker) {
			this.numberPicker.rootElem.remove();
			this.numberPicker = null;
		}
		if (this.enumPicker) {
			this.enumPicker.rootElem.remove();
			this.enumPicker = null;
		}
	}

	constructor(
		parent: HTMLElement,
		encounter: Encounter,
		targetIndex: number,
		targetInputIndex: number,
		config: ListItemPickerConfig<Encounter, TargetInput>,
	) {
		super(parent, 'target-input-picker-root', encounter, config);
		this.encounter = encounter;
		this.targetIndex = targetIndex;
		this.targetInputIndex = targetInputIndex;

		this.boolPicker = null;
		this.numberPicker = null;
		this.enumPicker = null;
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}
	getInputValue(): TargetInput {
		return TargetInput.create({
			boolValue: this.boolPicker ? this.boolPicker.getInputValue() : undefined,
			numberValue: this.numberPicker ? this.numberPicker.getInputValue() : undefined,
			enumValue: this.enumPicker ? this.enumPicker.getInputValue() : undefined,
		});
	}
	setInputValue(newTargetValue: TargetInput) {
		if (!newTargetValue) {
			return;
		}

		const sharedTrackingConfig: TrackEventProps = {
			action: 'settings',
			category: 'targets',
			label: newTargetValue.label,
		};

		if (newTargetValue.inputType == InputType.Number) {
			if (this.numberPicker && this.numberPicker.inputConfig.label === newTargetValue.label) {
				return;
			}

			this.clearPickers();
			this.numberPicker = new NumberPicker(this.rootElem, null, {
				id: randomUUID(),
				float: true,
				label: translateTargetInputLabel(newTargetValue.label),
				labelTooltip: translateTargetInputTooltip(newTargetValue.label, newTargetValue.tooltip),
				storeSubscribe: () => subscribeEncounterField(this.encounter, 'targets'),
				getValue: () => this.getTargetInput().numberValue,
				setValue: (eventID: EventID, _: null, newValue: number) => {
					trackEvent({
						...sharedTrackingConfig,
						value: newValue,
					});
					this.encounter.modifyTarget(eventID, this.targetIndex, target => {
						// Replace-on-write: mutate the draft. A missing input drops the
						// write (matching the old throwaway-object fallback).
						const input = target.targetInputs[this.targetInputIndex];
						if (input) input.numberValue = newValue;
					});
				},
			});
		} else if (newTargetValue.inputType == InputType.Bool) {
			if (this.boolPicker && this.boolPicker.inputConfig.label === newTargetValue.label) {
				return;
			}

			this.clearPickers();
			this.boolPicker = new BooleanPicker(this.rootElem, null, {
				id: randomUUID(),
				label: translateTargetInputLabel(newTargetValue.label),
				labelTooltip: translateTargetInputTooltip(newTargetValue.label, newTargetValue.tooltip),
				extraCssClasses: ['input-inline'],
				storeSubscribe: () => subscribeEncounterField(this.encounter, 'targets'),
				getValue: () => this.getTargetInput().boolValue,
				setValue: (eventID: EventID, _: null, newValue: boolean) => {
					trackEvent({
						...sharedTrackingConfig,
						value: newValue,
					});
					this.encounter.modifyTarget(eventID, this.targetIndex, target => {
						// Replace-on-write: mutate the draft. A missing input drops the
						// write (matching the old throwaway-object fallback).
						const input = target.targetInputs[this.targetInputIndex];
						if (input) input.boolValue = newValue;
					});
				},
			});
		} else if (newTargetValue.inputType == InputType.Enum) {
			this.clearPickers();
			this.enumPicker = new EnumPicker<null>(this.rootElem, null, {
				id: randomUUID(),
				label: translateTargetInputLabel(newTargetValue.label),
				values: newTargetValue.enumOptions.map((option, index) => {
					return { value: index, name: option };
				}),
				storeSubscribe: () => subscribeEncounterField(this.encounter, 'targets'),
				getValue: () => this.getTargetInput().enumValue,
				setValue: (eventID: EventID, _: null, newValue: number) => {
					trackEvent({
						...sharedTrackingConfig,
						value: newValue,
					});
					this.encounter.modifyTarget(eventID, this.targetIndex, target => {
						// Replace-on-write: mutate the draft. A missing input drops the
						// write (matching the old throwaway-object fallback).
						const input = target.targetInputs[this.targetInputIndex];
						if (input) input.enumValue = newValue;
					});
				},
			});
		}
	}
}

function addEncounterFieldPickers(rootElem: HTMLElement, encounter: Encounter, showExecuteProportion: boolean) {
	const durationGroup = Input.newGroupContainer();
	rootElem.appendChild(durationGroup);
	new NumberPicker(durationGroup, encounter, {
		id: 'encounter-duration',
		label: i18n.t('settings_tab.encounter.duration.label'),
		labelTooltip: i18n.t('settings_tab.encounter.duration.tooltip'),
		storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
		getValue: (encounter: Encounter) => encounter.getDuration(),
		setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
			trackEvent({
				action: 'settings',
				category: 'duration',
				label: 'duration',
				value: newValue,
			});
			encounter.setDuration(eventID, newValue);
		},
		enableWhen: _obj => {
			return !encounter.getUseHealth();
		},
	});
	new NumberPicker(durationGroup, encounter, {
		id: 'encounter-duration-variation',
		label: i18n.t('settings_tab.encounter.duration_variation.label'),
		labelTooltip: i18n.t('settings_tab.encounter.duration_variation.tooltip'),
		storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
		getValue: (encounter: Encounter) => encounter.getDurationVariation(),
		setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
			trackEvent({
				action: 'settings',
				category: 'duration',
				label: 'variation',
				value: newValue,
			});
			encounter.setDurationVariation(eventID, newValue);
		},
		enableWhen: _obj => {
			return !encounter.getUseHealth();
		},
	});

	if (showExecuteProportion) {
		const executeGroup = Input.newGroupContainer();
		executeGroup.classList.add('execute-group');
		rootElem.appendChild(executeGroup);

		new NumberPicker(executeGroup, encounter, {
			id: 'encounter-execute-proportion',
			label: i18n.t('settings_tab.encounter.execute_duration_20.label'),
			labelTooltip: i18n.t('settings_tab.encounter.execute_duration_20.tooltip'),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
			getValue: (encounter: Encounter) => encounter.getExecuteProportion20() * 100,
			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'execute',
					label: 'execute_20',
					value: newValue,
				});
				encounter.setExecuteProportion20(eventID, newValue / 100);
			},
			enableWhen: _obj => {
				return !encounter.getUseHealth();
			},
		});
		new NumberPicker(executeGroup, encounter, {
			id: 'encounter-execute-proportion-25',
			label: i18n.t('settings_tab.encounter.execute_duration_25.label'),
			labelTooltip: i18n.t('settings_tab.encounter.execute_duration_25.tooltip'),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
			getValue: (encounter: Encounter) => encounter.getExecuteProportion25() * 100,
			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'execute',
					label: 'execute_25',
					value: newValue,
				});
				encounter.setExecuteProportion25(eventID, newValue / 100);
			},
			enableWhen: _obj => {
				return !encounter.getUseHealth();
			},
		});
		new NumberPicker(executeGroup, encounter, {
			id: 'encounter-execute-proportion-35',
			label: i18n.t('settings_tab.encounter.execute_duration_35.label'),
			labelTooltip: i18n.t('settings_tab.encounter.execute_duration_35.tooltip'),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
			getValue: (encounter: Encounter) => encounter.getExecuteProportion35() * 100,
			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'execute',
					label: 'execute_35',
					value: newValue,
				});
				encounter.setExecuteProportion35(eventID, newValue / 100);
			},
			enableWhen: _obj => {
				return !encounter.getUseHealth();
			},
		});
		new NumberPicker(executeGroup, encounter, {
			id: 'encounter-execute-proportion-45',
			label: i18n.t('settings_tab.encounter.execute_duration_45.label'),
			labelTooltip: i18n.t('settings_tab.encounter.execute_duration_45.tooltip'),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
			getValue: (encounter: Encounter) => encounter.getExecuteProportion45() * 100,
			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'execute',
					label: 'execute_45',
					value: newValue,
				});
				encounter.setExecuteProportion45(eventID, newValue / 100);
			},
			enableWhen: _obj => {
				return !encounter.getUseHealth();
			},
		});
		new NumberPicker(executeGroup, encounter, {
			id: 'encounter-execute-proportion-90',
			label: i18n.t('settings_tab.encounter.duration_below_high_hp.label'),
			labelTooltip: i18n.t('settings_tab.encounter.duration_below_high_hp.tooltip'),
			storeSubscribe: (encounter: Encounter) => subscribeEncounterChange(encounter),
			getValue: (encounter: Encounter) => encounter.getExecuteProportion90() * 100,
			setValue: (eventID: EventID, encounter: Encounter, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'execute',
					label: 'execute_90',
					value: newValue,
				});
				encounter.setExecuteProportion90(eventID, newValue / 100);
			},
			enableWhen: _obj => {
				return !encounter.getUseHealth();
			},
		});
	}
}

function makeTargetInputsPicker(parent: HTMLElement, encounter: Encounter, targetIndex: number) {
	return new ListPicker<Encounter, TargetInput>(parent, encounter, {
		allowedActions: [],
		itemLabel: i18n.t('settings_tab.encounter.target_inputs.label'),
		extraCssClasses: ['mt-2'],
		isCompact: true,
		storeSubscribe: (encounter: Encounter) => subscribeEncounterField(encounter, 'targets'),
		getValue: (encounter: Encounter) => encounter.getTargets()[targetIndex].targetInputs.slice(),
		setValue: (eventID: EventID, encounter: Encounter, newValue: Array<TargetInput>) => {
			trackEvent({
				action: 'settings',
				category: 'targets',
				label: 'count',
				value: newValue.length,
			});
			encounter.modifyTarget(eventID, targetIndex, target => {
				target.targetInputs = newValue;
			});
		},
		newItem: () => TargetInput.create(),
		copyItem: (oldItem: TargetInput) => TargetInput.clone(oldItem),
		newItemPicker: (
			parent: HTMLElement,
			listPicker: ListPicker<Encounter, TargetInput>,
			index: number,
			config: ListItemPickerConfig<Encounter, TargetInput>,
		) => new TargetInputPicker(parent, encounter, targetIndex, index, config),
	});
}

function equalTargetsIgnoreInputs(target1: TargetProto | undefined, target2: TargetProto | undefined): boolean {
	if (!!target1 != !!target2) {
		return false;
	}
	if (!target1) {
		return true;
	}
	const modTarget2 = TargetProto.clone(target2!);
	modTarget2.targetInputs = target1.targetInputs;
	return TargetProto.equals(target1, modTarget2);
}

const ALL_TARGET_STATS: Array<{ stat: Stat; tooltip: string; extraCssClasses: Array<string> }> = [
	{ stat: Stat.StatHealth, tooltip: '', extraCssClasses: [] },
	{ stat: Stat.StatArmor, tooltip: '', extraCssClasses: [] },
	{ stat: Stat.StatAttackPower, tooltip: '', extraCssClasses: ['threat-metrics'] },
];

const mobTypeEnumValues = [
	{ name: translateMobType(MobType.MobTypeUnknown), value: MobType.MobTypeUnknown },
	{ name: translateMobType(MobType.MobTypeBeast), value: MobType.MobTypeBeast },
	{ name: translateMobType(MobType.MobTypeDemon), value: MobType.MobTypeDemon },
	{ name: translateMobType(MobType.MobTypeDragonkin), value: MobType.MobTypeDragonkin },
	{ name: translateMobType(MobType.MobTypeElemental), value: MobType.MobTypeElemental },
	{ name: translateMobType(MobType.MobTypeGiant), value: MobType.MobTypeGiant },
	{ name: translateMobType(MobType.MobTypeHumanoid), value: MobType.MobTypeHumanoid },
	{ name: translateMobType(MobType.MobTypeMechanical), value: MobType.MobTypeMechanical },
	{ name: translateMobType(MobType.MobTypeUndead), value: MobType.MobTypeUndead },
];
