import type { APLValidation } from '@generated/proto/api';
import type { Player } from '@sim/player/player';

/** The sim's validations for one message, matched by its uuid. */
export const uuidValidations = (player: Player<any>, uuid: string | undefined): Array<APLValidation> =>
	(uuid && player.getCurrentStats().rotationStats?.uuidValidations?.find(entry => entry.uuid?.value === uuid)?.validations) || [];
