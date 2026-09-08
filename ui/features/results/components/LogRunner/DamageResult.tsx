import type { DamageLog } from '@sim/proto/combat_log';
import { isAvoidedOutcome } from '@sim/proto/combat_log/types';
import { spellSchoolNames } from '@sim/proto/names';
import clsx from 'clsx';

import { EntityLabel } from './EntityLabel';
import { OUTCOME_LABEL } from './utils';

export interface DamageResultProps {
	log: DamageLog;
}

/** The outcome-and-amount tail of a damage, healing or shielding line. */
export const DamageResult = ({ log }: DamageResultProps) => {
	const spellSchoolString = typeof log.spellSchool === 'number' ? spellSchoolNames.get(log.spellSchool) : undefined;
	const isHealing = log.effect === 'healing';
	const isShielding = log.effect === 'shielding';
	const isMissLike = isAvoidedOutcome(log.outcome);
	const outcomeLabel = log.outcome === 'hit' && log.tick ? 'Tick' : OUTCOME_LABEL[log.outcome];

	return (
		<>
			{isHealing ? 'Healed ' : ''}
			{isShielding ? 'Shielded ' : ''}
			{!(isHealing || isShielding) && <>{outcomeLabel}</>}
			{` `}
			{log.target ? <EntityLabel entity={log.target} /> : ''}
			{!isMissLike ? (
				<>
					{' '}
					for{' '}
					{isHealing || isShielding ? (
						<strong className="resource-health">{log.amount.toFixed(2)} health</strong>
					) : (
						<strong className={clsx('text-danger', spellSchoolString && `spell-school-${spellSchoolString.toLowerCase()}`)}>
							{log.amount.toFixed(2)} damage
							{spellSchoolString && <> ({spellSchoolString})</>}
						</strong>
					)}
					.
				</>
			) : (
				''
			)}
		</>
	);
};
