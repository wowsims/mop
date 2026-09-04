import { Spec } from '@generated/proto/common';

import type { SpecConfigData } from '../player';

export function getRequiredTalentRows<SpecType extends Spec>(specConfig: Pick<SpecConfigData<SpecType>, 'requiredTalentRows'>): number[] {
	if (specConfig.requiredTalentRows) {
		return specConfig.requiredTalentRows;
	}
	return [0, 1, 2, 3, 4, 5];
}

export function hasRequiredTalents<SpecType extends Spec>(specConfig: Pick<SpecConfigData<SpecType>, 'requiredTalentRows'>, talentsString: string): boolean {
	const requiredRows = getRequiredTalentRows(specConfig);
	const talentPoints = talentsString.split('').map(Number);

	return requiredRows.every(rowIndex => talentPoints[rowIndex] > 0);
}

export function getMissingTalentRows<SpecType extends Spec>(specConfig: Pick<SpecConfigData<SpecType>, 'requiredTalentRows'>, talentsString: string): number[] {
	const requiredRows = getRequiredTalentRows(specConfig);
	const talentPoints = talentsString.split('').map(Number);

	return requiredRows.filter(rowIndex => talentPoints[rowIndex] === 0);
}
