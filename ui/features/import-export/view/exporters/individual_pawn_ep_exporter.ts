import { UnitStat } from '@domain/proto_utils/stats';
import { PseudoStat, Spec, Stat } from '@generated/proto/common';
import i18n from '@i18n/config';

import type { IndividualSimHost } from '../../../sim_host';
import { IndividualExporter } from './individual_exporter';

export class IndividualPawnEPExporter<SpecType extends Spec> extends IndividualExporter<SpecType> {
	constructor(parent: HTMLElement, simUI: IndividualSimHost<SpecType>) {
		super(parent, simUI, { title: i18n.t('export.pawn_ep.title'), allowDownload: true });
	}

	getData(): string {
		const player = this.simUI.player;
		const epValues = player.getEpWeights();
		const allUnitStats = UnitStat.getAll();

		const namesToWeights: Record<string, number> = {};
		allUnitStats.forEach(stat => {
			const statName = IndividualPawnEPExporter.getName(stat);
			const weight = epValues.getUnitStat(stat);
			if (weight == 0 || statName == '') {
				return;
			}

			// Need to add together stats with the same name (e.g. hit/crit/haste).
			if (namesToWeights[statName]) {
				namesToWeights[statName] += weight;
			} else {
				namesToWeights[statName] = weight;
			}
		});

		return (
			`( Pawn: v1: "${player.getPlayerSpec().friendlyName} WoWSims Weights": Class=${player.getPlayerClass().friendlyName},` +
			Object.keys(namesToWeights)
				.map(statName => `${statName}=${namesToWeights[statName].toFixed(3)}`)
				.join(',') +
			' )'
		);
	}

	static getName(stat: UnitStat): string {
		if (stat.isStat()) {
			return IndividualPawnEPExporter.statNames[stat.getStat()];
		} else {
			return IndividualPawnEPExporter.pseudoStatNames[stat.getPseudoStat()] || '';
		}
	}

	static statNames: Record<Stat, string> = {
		[Stat.StatStrength]: 'Strength',
		[Stat.StatAgility]: 'Agility',
		[Stat.StatStamina]: 'Stamina',
		[Stat.StatIntellect]: 'Intellect',
		[Stat.StatSpirit]: 'Spirit',
		[Stat.StatSpellPower]: 'SpellDamage',
		[Stat.StatMP5]: 'Mp5',
		[Stat.StatHitRating]: 'HitRating',
		[Stat.StatCritRating]: 'CritRating',
		[Stat.StatHasteRating]: 'HasteRating',
		[Stat.StatAttackPower]: 'Ap',
		[Stat.StatMasteryRating]: 'MasteryRating',
		[Stat.StatExpertiseRating]: 'ExpertiseRating',
		[Stat.StatMana]: 'Mana',
		[Stat.StatArmor]: 'Armor',
		[Stat.StatRangedAttackPower]: 'Ap',
		[Stat.StatDodgeRating]: 'DodgeRating',
		[Stat.StatParryRating]: 'ParryRating',
		// TODO: Change PVP Resilience and Power once Pawn exists for MoP
		[Stat.StatPvpResilienceRating]: 'ResilienceRating',
		[Stat.StatPvpPowerRating]: 'PVPPowerRating',
		[Stat.StatHealth]: 'Health',
		[Stat.StatBonusArmor]: 'Armor2',
	};
	static pseudoStatNames: Partial<Record<PseudoStat, string>> = {
		[PseudoStat.PseudoStatMainHandDps]: 'MeleeDps',
		[PseudoStat.PseudoStatRangedDps]: 'RangedDps',
	};
}
