import { IndividualSimUIConfig } from '@core/individual_sim_ui';
import { Spec } from '@core/proto/common';

export function getRequiredTalentRows<SpecType extends Spec>(specConfig: IndividualSimUIConfig<SpecType>): number[] {
	if (specConfig.requiredTalentRows) {
		return specConfig.requiredTalentRows;
	}
	return [0, 1, 2, 3, 4, 5];
}

export function hasRequiredTalents<SpecType extends Spec>(specConfig: IndividualSimUIConfig<SpecType>, talentsString: string): boolean {
	const requiredRows = getRequiredTalentRows(specConfig);
	const talentPoints = talentsString.split('').map(Number);

	return requiredRows.every(rowIndex => talentPoints[rowIndex] > 0);
}

export function getMissingTalentRows<SpecType extends Spec>(specConfig: IndividualSimUIConfig<SpecType>, talentsString: string): number[] {
	const requiredRows = getRequiredTalentRows(specConfig);
	const talentPoints = talentsString.split('').map(Number);

	return requiredRows.filter(rowIndex => talentPoints[rowIndex] === 0);
}
