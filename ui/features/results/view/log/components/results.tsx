/** @jsxImportSource @jsx-vanilla */
import type { DamageLog, Outcome } from '@domain/proto_utils/combat_log';
import { spellSchoolNames } from '@domain/proto_utils/names';
import clsx from 'clsx';

import { EntityLabel } from './entity_label';

export const OUTCOME_LABEL: Record<Outcome, string> = {
	miss: 'Miss',
	dodge: 'Dodge',
	parry: 'Parry',
	'critical-block': 'Critical Block',
	'blocked-glance': 'Blocked Glance',
	block: 'Block',
	glance: 'Glance',
	crit: 'Crit',
	hit: 'Hit',
};

export function Results(log: DamageLog): JSX.Element {
	const spellSchoolString = typeof log.spellSchool === 'number' ? spellSchoolNames.get(log.spellSchool) : undefined;
	const isHealing = log.effect === 'healing';
	const isShielding = log.effect === 'shielding';
	const isMissLike = log.outcome === 'miss' || log.outcome === 'dodge' || log.outcome === 'parry';
	const outcomeLabel = log.outcome === 'hit' && log.tick ? 'Tick' : OUTCOME_LABEL[log.outcome];

	return (
		<>
			{isHealing ? 'Healed ' : ''}
			{isShielding ? 'Shielded ' : ''}
			{!(isHealing || isShielding) && <>{outcomeLabel}</>}
			{` `}
			{log.target ? EntityLabel(log.target) : ''}
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
}
