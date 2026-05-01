import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../i18n/config.js';
import * as Mechanics from '../constants/mechanics.js';
import { IndividualSimUI } from '../individual_sim_ui';
import { Player } from '../player.js';
import { ItemSlot, PseudoStat, Race, Spec, Stat, WeaponType } from '../proto/common.js';
import { ActionId } from '../proto_utils/action_id';
import { getStatName, masterySpellIDs } from '../proto_utils/names.js';
import { Stats, UnitStat } from '../proto_utils/stats.js';
import { EventID, TypedEvent } from '../typed_event.js';
import { Component } from './component.js';
import { NumberPicker } from './pickers/number_picker.js';
import { translateMasterySpellName } from '../../i18n/localization.js';

export type StatMods = { base?: Stats; gear?: Stats; talents?: Stats; buffs?: Stats; consumes?: Stats; final?: Stats; stats?: Array<Stat> };
export type StatWrites = { base: Stats; gear: Stats; talents: Stats; buffs: Stats; consumes: Stats; final: Stats; stats: Array<Stat> };

enum StatGroup {
	Primary = 'Primary',
	Attributes = 'Attributes',
	Physical = 'Physical',
	Spell = 'Spell',
	Defense = 'Defense',
}

export class CharacterStats extends Component {
	readonly stats: Array<UnitStat>;
	readonly valueElems: Array<HTMLTableCellElement>;
	readonly meleeCritCapValueElem: HTMLTableCellElement | undefined;
	masteryElem: HTMLTableCellElement | undefined;
	hasRacialHitBonus = false;
	activeRacialExpertiseBonuses = [false, false];

	private readonly player: Player<any>;
	private readonly modifyDisplayStats?: (player: Player<any>) => StatMods;
	private readonly overwriteDisplayStats?: (player: Player<any>) => StatWrites;

	constructor(
		parent: HTMLElement,
		simUI: IndividualSimUI<any>,
		player: Player<any>,
		statList: Array<UnitStat>,
		modifyDisplayStats?: (player: Player<any>) => StatMods,
		overwriteDisplayStats?: (player: Player<any>) => StatWrites,
	) {
		super(parent, 'character-stats-root');
		this.stats = [];
		this.player = player;
		this.modifyDisplayStats = modifyDisplayStats;
		this.overwriteDisplayStats = overwriteDisplayStats;

		const label = document.createElement('label');
		label.classList.add('character-stats-label');
		label.textContent = i18n.t('sidebar.character_stats.title');
		this.rootElem.appendChild(label);

		const table = document.createElement('table');
		table.classList.add('character-stats-table');
		this.rootElem.appendChild(table);

		this.valueElems = [];

		const statGroups = new Map<StatGroup, Array<UnitStat>>([
			[StatGroup.Primary, [UnitStat.fromStat(Stat.StatHealth), UnitStat.fromStat(Stat.StatMana)]],
			[
				StatGroup.Attributes,
				[
					UnitStat.fromStat(Stat.StatStrength),
					UnitStat.fromStat(Stat.StatAgility),
					UnitStat.fromStat(Stat.StatStamina),
					UnitStat.fromStat(Stat.StatIntellect),
					UnitStat.fromStat(Stat.StatSpirit),
					UnitStat.fromStat(Stat.StatPvpPowerRating),
					UnitStat.fromStat(Stat.StatPvpResilienceRating),
				],
			],
			[
				StatGroup.Defense,
				[
					UnitStat.fromStat(Stat.StatArmor),
					UnitStat.fromStat(Stat.StatBonusArmor),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatDodgePercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatParryPercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatBlockPercent),
				],
			],
			[
				StatGroup.Physical,
				[
					UnitStat.fromStat(Stat.StatAttackPower),
					UnitStat.fromStat(Stat.StatRangedAttackPower),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeHastePercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatRangedHastePercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent),
				],
			],
			[
				StatGroup.Spell,
				[
					UnitStat.fromStat(Stat.StatSpellPower),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHitPercent),
					UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellCritPercent),
				],
			],
		]);

		if (this.player.getPlayerSpec().isTankSpec) {
			const hitIndex = statGroups.get(StatGroup.Physical)!.findIndex(stat => stat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent));
			statGroups.get(StatGroup.Physical)!.splice(hitIndex + 1, 0, UnitStat.fromStat(Stat.StatExpertiseRating));
			statGroups.get(StatGroup.Defense)!.push(UnitStat.fromStat(Stat.StatMasteryRating));
		} else if ([Stat.StatIntellect, Stat.StatSpellPower].includes(simUI.individualConfig.epReferenceStat)) {
			const hitIndex = statGroups.get(StatGroup.Spell)!.findIndex(stat => stat.equalsPseudoStat(PseudoStat.PseudoStatSpellHitPercent));
			statGroups.get(StatGroup.Spell)!.splice(hitIndex + 1, 0, UnitStat.fromStat(Stat.StatExpertiseRating));
			statGroups.get(StatGroup.Spell)!.push(UnitStat.fromStat(Stat.StatMasteryRating));
		} else {
			const hitIndex = statGroups.get(StatGroup.Physical)!.findIndex(stat => stat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent));
			statGroups.get(StatGroup.Physical)!.splice(hitIndex + 1, 0, UnitStat.fromStat(Stat.StatExpertiseRating));
			statGroups.get(StatGroup.Physical)!.push(UnitStat.fromStat(Stat.StatMasteryRating));
		}

		statGroups.forEach((groupedStats, key) => {
			const filteredStats = groupedStats.filter(stat => statList.find(listStat => listStat.equals(stat)));
			if (!filteredStats.length) return;

			// Don't show mastery twice if the spec doesn't care about both Physical and Spell
			if ([StatGroup.Physical, StatGroup.Spell].includes(key) && filteredStats.length === 1) return;

			const body = <tbody></tbody>;
			filteredStats.forEach(unitStat => {
				this.stats.push(unitStat);
				const statName = unitStat.getShortName(player.getClass());

				const valueRef = ref<HTMLTableCellElement>();
				const row = (
					<tr className="character-stats-table-row">
						<td className="character-stats-table-label">
							{statName}
							{unitStat.equalsStat(Stat.StatMasteryRating) && <div>{translateMasterySpellName(this.player.getSpec())}</div>}
						</td>
						<td ref={valueRef} className="character-stats-table-value">
							{unitStat.hasRootStat() && this.bonusStatsLink(unitStat)}
						</td>
					</tr>
				);
				body.appendChild(row);
				this.valueElems.push(valueRef.value!);

				if (unitStat.isPseudoStat() && unitStat.getPseudoStat() === PseudoStat.PseudoStatPhysicalCritPercent && this.shouldShowMeleeCritCap(player)) {
					const critCapRow = (
						<tr className="character-stats-table-row">
							<td className="character-stats-table-label">{i18n.t('sidebar.character_stats.melee_crit_cap')}</td>
							<td className="character-stats-table-value">
								{/* Hacky placeholder for spacing */}
								<span className="px-2 border-start border-end border-body border-brand" style={{ '--bs-border-opacity': '0' }} />
							</td>
						</tr>
					);
					body.appendChild(critCapRow);

					const critCapValueElem = critCapRow.getElementsByClassName('character-stats-table-value')[0] as HTMLTableCellElement;
					this.valueElems.push(critCapValueElem);
				}
			});

			table.appendChild(body);
		});

		this.updateStats(player);
		TypedEvent.onAny([player.currentStatsEmitter, player.sim.changeEmitter, player.talentsChangeEmitter]).on(() => {
			this.updateStats(player);
		});
	}

	private updateStats(player: Player<any>) {
		const playerStats = player.getCurrentStats();
		const statMods = this.modifyDisplayStats ? this.modifyDisplayStats(this.player) : {};
		this.hasRacialHitBonus = this.player.getRace() === Race.RaceDraenei;
		this.activeRacialExpertiseBonuses = this.player.getActiveRacialExpertiseBonuses();

		const baseStats = Stats.fromProto(playerStats.baseStats);
		const gearStats = Stats.fromProto(playerStats.gearStats);
		const talentsStats = Stats.fromProto(playerStats.talentsStats);
		const buffsStats = Stats.fromProto(playerStats.buffsStats);
		const consumesStats = Stats.fromProto(playerStats.consumesStats);
		const bonusStats = player.getBonusStats();

		let finalStats = Stats.fromProto(playerStats.finalStats)
			.add(statMods.base || new Stats())
			.add(statMods.gear || new Stats())
			.add(statMods.talents || new Stats())
			.add(statMods.buffs || new Stats())
			.add(statMods.consumes || new Stats())
			.add(statMods.final || new Stats());

		let baseDelta = baseStats.add(statMods.base || new Stats());
		let gearDelta = gearStats
			.subtract(baseStats)
			.subtract(bonusStats)
			.add(statMods.gear || new Stats());
		let talentsDelta = talentsStats.subtract(gearStats).add(statMods.talents || new Stats());
		let buffsDelta = buffsStats.subtract(talentsStats).add(statMods.buffs || new Stats());
		let consumesDelta = consumesStats.subtract(buffsStats).add(statMods.consumes || new Stats());

		if (this.overwriteDisplayStats) {
			const statOverwrites = this.overwriteDisplayStats(this.player);
			if (statOverwrites.stats) {
				statOverwrites.stats.forEach((stat, _) => {
					baseDelta = baseDelta.withStat(stat, statOverwrites.base.getStat(stat));
					gearDelta = gearDelta.withStat(stat, statOverwrites.gear.getStat(stat));
					talentsDelta = talentsDelta.withStat(stat, statOverwrites.talents.getStat(stat));
					buffsDelta = buffsDelta.withStat(stat, statOverwrites.buffs.getStat(stat));
					consumesDelta = consumesDelta.withStat(stat, statOverwrites.consumes.getStat(stat));
					finalStats = finalStats.withStat(stat, statOverwrites.final.getStat(stat));
				});
			}
		}

		const masteryPoints =
			this.player.getBaseMastery() + (playerStats.finalStats?.stats[Stat.StatMasteryRating] || 0) / Mechanics.MASTERY_RATING_PER_MASTERY_POINT;

		let idx = 0;
		this.stats.forEach(unitStat => {
			const bonusStatValue = unitStat.hasRootStat() ? bonusStats.getStat(unitStat.getRootStat()) : 0;
			let contextualClass: string;
			if (bonusStatValue == 0) {
				contextualClass = 'text-white';
			} else if (bonusStatValue > 0) {
				contextualClass = 'text-success';
			} else {
				contextualClass = 'text-danger';
			}

			const statLinkElemRef = ref<HTMLButtonElement>();

			// Custom "HACK" for Warlock/Protection Warrior..
			// they have two different mastery scalings
			// And a different base mastery value..
			let modifier = [this.player.getMasteryPerPointModifier()];
			let customBonus = [0];
			switch (player.getSpec()) {
				case Spec.SpecDestructionWarlock:
					customBonus = [1, 0];
					modifier = [1, ...modifier];
					break;
				case Spec.SpecDemonologyWarlock:
					customBonus = [0, 0];
					modifier = [1, ...modifier];
					break;
				case Spec.SpecProtectionWarrior:
					customBonus = [0, 0];
					modifier = [0.5, ...modifier];
					break;
				case Spec.SpecWindwalkerMonk:
					customBonus = [3.5, 0];
					break;
				case Spec.SpecBalanceDruid:
					customBonus = [15.0];
					break;
			}

			const valueElem = (
				<div className="stat-value-link-container">
					<button ref={statLinkElemRef} className={clsx('stat-value-link', contextualClass)}>
						{`${this.statDisplayString(finalStats, unitStat, true)} `}
					</button>
					{unitStat.equalsStat(Stat.StatMasteryRating) &&
						modifier.map((modifier, index) => (
							<a
								href={ActionId.makeSpellUrl(masterySpellIDs.get(this.player.getSpec()) || 0)}
								className={clsx('stat-value-link-mastery', contextualClass)}
								target="_blank">
								{`${(masteryPoints * modifier + customBonus[index]).toFixed(2)}%`}
							</a>
						))}
				</div>
			);

			const statLinkElem = statLinkElemRef.value!;

			this.valueElems[idx].querySelector('.stat-value-link-container')?.remove();
			this.valueElems[idx].prepend(valueElem);

			const tooltipContent = (
				<div>
					<div className="character-stats-tooltip-row">
						<span>{i18n.t('sidebar.character_stats.tooltip.base')}</span>
						<span>{this.statDisplayString(baseDelta, unitStat, true)}</span>
					</div>
					<div className="character-stats-tooltip-row">
						<span>{i18n.t('sidebar.character_stats.tooltip.gear')}</span>
						<span>{this.statDisplayString(gearDelta, unitStat)}</span>
					</div>
					<div className="character-stats-tooltip-row">
						<span>{i18n.t('sidebar.character_stats.tooltip.talents')}</span>
						<span>{this.statDisplayString(talentsDelta, unitStat)}</span>
					</div>
					<div className="character-stats-tooltip-row">
						<span>{i18n.t('sidebar.character_stats.tooltip.buffs')}</span>
						<span>{this.statDisplayString(buffsDelta, unitStat)}</span>
					</div>
					<div className="character-stats-tooltip-row">
						<span>{i18n.t('sidebar.character_stats.tooltip.consumes')}</span>
						<span>{this.statDisplayString(consumesDelta, unitStat)}</span>
					</div>
					{bonusStatValue !== 0 && (
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.tooltip.bonus')}</span>
							<span>{this.statDisplayString(bonusStats, unitStat)}</span>
						</div>
					)}
					<div className="character-stats-tooltip-row">
						<span>{i18n.t('sidebar.character_stats.tooltip.total')}</span>
						<span>{this.statDisplayString(finalStats, unitStat, true)}</span>
					</div>
					{unitStat.isPseudoStat() && unitStat.getPseudoStat() === PseudoStat.PseudoStatSpellHitPercent && (
						<div className="character-stats-tooltip-row">
							<span>
								<i>Total Includes Expertise</i>
							</span>
						</div>
					)}
					{unitStat.isStat() && unitStat.getStat() === Stat.StatExpertiseRating && (
						<div className="character-stats-tooltip-row">
							<span>
								<i>Contributes to Spell Hit</i>
							</span>
						</div>
					)}
				</div>
			);

			if (unitStat.isPseudoStat() && unitStat.getPseudoStat() === PseudoStat.PseudoStatPhysicalCritPercent && this.shouldShowMeleeCritCap(player)) {
				idx++;

				const meleeCritCapInfo = player.getMeleeCritCapInfo();
				const valueElem = <button className="stat-value-link">{this.meleeCritCapDisplayString(player, finalStats)} </button>;

				const capDelta = meleeCritCapInfo.playerCritCapDelta;
				if (capDelta == 0) {
					valueElem.classList.add('text-white');
				} else if (capDelta > 0) {
					valueElem.classList.add('text-danger');
				} else if (capDelta < 0) {
					valueElem.classList.add('text-success');
				}

				this.valueElems[idx].querySelector('.stat-value-link-container')?.remove();
				this.valueElems[idx].prepend(<div className="stat-value-link-container">{valueElem}</div>);

				const critCapTooltipContent = (
					<div>
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.attack_table.glancing')}</span>
							<span>{`${meleeCritCapInfo.glancing.toFixed(2)}%`}</span>
						</div>
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.attack_table.suppression')}</span>
							<span>{`${meleeCritCapInfo.suppression.toFixed(2)}%`}</span>
						</div>
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.attack_table.to_hit_cap')}</span>
							<span>{`${meleeCritCapInfo.remainingMeleeHitCap.toFixed(2)}%`}</span>
						</div>
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.attack_table.to_exp_cap')}</span>
							<span>{`${meleeCritCapInfo.remainingExpertiseCap.toFixed(2)}%`}</span>
						</div>
						{meleeCritCapInfo.specSpecificOffset != 0 && (
							<div className="character-stats-tooltip-row">
								<span>{i18n.t('sidebar.character_stats.attack_table.spec_offsets')}</span>
								<span>{`${meleeCritCapInfo.specSpecificOffset.toFixed(2)}%`}</span>
							</div>
						)}
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.attack_table.final_crit_cap')}</span>
							<span>{`${meleeCritCapInfo.baseCritCap.toFixed(2)}%`}</span>
						</div>
						<hr />
						<div className="character-stats-tooltip-row">
							<span>{i18n.t('sidebar.character_stats.attack_table.can_raise_by')}</span>
							<span>{`${(meleeCritCapInfo.remainingExpertiseCap + meleeCritCapInfo.remainingMeleeHitCap).toFixed(2)}%`}</span>
						</div>
					</div>
				);

				tippy(valueElem, {
					content: critCapTooltipContent,
				});
			}

			tippy(statLinkElem, {
				content: tooltipContent,
			});

			idx++;
		});
	}

	private statDisplayString(deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean): string {
		const rootStat = unitStat.hasRootStat() ? unitStat.getRootStat() : null;
		let rootRatingValue = rootStat !== null ? deltaStats.getStat(rootStat) : null;
		let derivedPercentOrPointsValue = unitStat.convertDefaultUnitsToPercent(deltaStats.getUnitStat(unitStat));
		const percentOrPointsSuffix = unitStat.equalsStat(Stat.StatMasteryRating)
			? ` ${i18n.t('sidebar.character_stats.points_suffix')}`
			: i18n.t('sidebar.character_stats.percent_suffix');

		if (unitStat.equalsStat(Stat.StatMasteryRating) && includeBase) {
			derivedPercentOrPointsValue = derivedPercentOrPointsValue! + this.player.getBaseMastery();
		} else if (rootStat === Stat.StatHitRating && includeBase && this.hasRacialHitBonus) {
			// Remove the rating display and only show %
			if (rootRatingValue !== null && rootRatingValue > 0) {
				rootRatingValue -= Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT;
			}
		} else if (unitStat.equalsStat(Stat.StatExpertiseRating) && includeBase) {
			const [mhWeaponExpertiseActive, ohWeaponExpertiseActive] = this.activeRacialExpertiseBonuses;

			// Remove the rating display and only show %
			if (rootRatingValue !== null && rootRatingValue > 0 && mhWeaponExpertiseActive) {
				rootRatingValue -= Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION * 4;
			}

			const matchesBothHands = mhWeaponExpertiseActive && ohWeaponExpertiseActive;
			const offHand = this.player.getEquippedItem(ItemSlot.ItemSlotOffHand);
			if (
				!matchesBothHands &&
				(mhWeaponExpertiseActive || ohWeaponExpertiseActive) &&
				offHand !== null &&
				offHand.item.weaponType !== WeaponType.WeaponTypeShield &&
				offHand.item.weaponType !== WeaponType.WeaponTypeOffHand
			) {
				const hideRootRating = rootRatingValue === null || (rootRatingValue === 0 && derivedPercentOrPointsValue !== null);
				const rootRatingString = hideRootRating ? '' : String(Math.round(rootRatingValue!));
				const mhPercentString = `${derivedPercentOrPointsValue!.toFixed(2)}` + percentOrPointsSuffix;
				const ohPercentValue = derivedPercentOrPointsValue! + (ohWeaponExpertiseActive ? 1 : -1);
				const ohPercentString = `${ohPercentValue.toFixed(2)}` + percentOrPointsSuffix;
				const wrappedPercentString = hideRootRating ? `${mhPercentString} / ${ohPercentString}` : ` (${mhPercentString} / ${ohPercentString})`;
				return rootRatingString + wrappedPercentString;
			}
		}

		const hideRootRating = rootRatingValue === null || (rootRatingValue === 0 && derivedPercentOrPointsValue !== null);
		const rootRatingString = hideRootRating ? '' : String(Math.round(rootRatingValue!));
		const percentOrPointsString = derivedPercentOrPointsValue === null ? '' : `${derivedPercentOrPointsValue.toFixed(2)}` + percentOrPointsSuffix;
		const wrappedPercentOrPointsString = hideRootRating || derivedPercentOrPointsValue === null ? percentOrPointsString : ` (${percentOrPointsString})`;
		return rootRatingString + wrappedPercentOrPointsString;
	}

	private bonusStatsLink(unitStat: UnitStat): HTMLElement {
		const rootStat = unitStat.getRootStat();
		const statName = getStatName(rootStat);
		const linkRef = ref<HTMLButtonElement>();
		const iconRef = ref<HTMLDivElement>();

		const link = (
			<button ref={linkRef} className="add-bonus-stats text-white ms-2" dataset={{ bsToggle: 'popover' }}>
				<i ref={iconRef} className="fas fa-plus-minus"></i>
			</button>
		);

		tippy(iconRef.value!, { content: `${i18n.t('sidebar.character_stats.bonus_prefix')} ${statName}` });
		tippy(linkRef.value!, {
			interactive: true,
			trigger: 'click',
			theme: 'bonus-stats-popover',
			placement: 'right',
			onShow: instance => {
				const picker = new NumberPicker(null, this.player, {
					id: `character-bonus-stat-${rootStat}`,
					label: `${i18n.t('sidebar.character_stats.bonus_prefix')} ${statName}`,
					extraCssClasses: ['mb-0'],
					changedEvent: (player: Player<any>) => player.bonusStatsChangeEmitter,
					getValue: (player: Player<any>) => player.getBonusStats().getStat(rootStat),
					setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
						const bonusStats = player.getBonusStats().withStat(rootStat, newValue);
						player.setBonusStats(eventID, bonusStats);
						instance?.hide();
					},
				});
				instance.setContent(picker.rootElem);
			},
		});

		return link as HTMLElement;
	}

	private shouldShowMeleeCritCap(player: Player<any>): boolean {
		return player.getPlayerSpec().isMeleeDpsSpec;
	}

	private meleeCritCapDisplayString(player: Player<any>, _finalStats: Stats): string {
		const playerCritCapDelta = player.getMeleeCritCap();

		if (playerCritCapDelta === 0.0) {
			return i18n.t('sidebar.character_stats.crit_cap.exact');
		}

		const prefix = playerCritCapDelta > 0 ? i18n.t('sidebar.character_stats.crit_cap.over_by') : i18n.t('sidebar.character_stats.crit_cap.under_by');
		return `${prefix} ${Math.abs(playerCritCapDelta).toFixed(2)}%`;
	}
}
