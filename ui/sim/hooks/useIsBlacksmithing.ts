import { Profession } from '@generated/proto/common';

import { usePlayerStore } from './usePlayerStore';

export const useIsBlacksmithing = (): boolean => {
	const profession1 = usePlayerStore('profession1');
	const profession2 = usePlayerStore('profession2');
	return profession1 === Profession.Blacksmithing || profession2 === Profession.Blacksmithing;
};
