import { Player } from '../player';
import { APLAction, APLPrepullAction, APLRotation, APLRotation_Type } from '../proto/apl.js';
import { ActionID as ActionIdProto, Cooldowns, Spec } from '../proto/common.js';

export const isEqualAPLRotation = (player: Player<Spec>, rotation?: APLRotation, otherRotation?: APLRotation): boolean => {
	if (!!rotation != !!otherRotation) return false;

	const clonedRotation = rotation ? APLRotation.clone(rotation) : undefined;
	const clonedOtherRotation = otherRotation ? APLRotation.clone(otherRotation) : undefined;
	// Ensure that the auto rotation type can be matched
	if (clonedRotation?.type === APLRotation_Type.TypeAuto) clonedRotation.type = APLRotation_Type.TypeAPL;
	if (clonedOtherRotation?.type === APLRotation_Type.TypeAuto) clonedOtherRotation.type = APLRotation_Type.TypeAPL;

	if (clonedOtherRotation?.type === APLRotation_Type.TypeSimple && clonedOtherRotation?.simple?.specRotationJson) {
		return player.specTypeFunctions.rotationEquals(
			player.specTypeFunctions.rotationFromJson(JSON.parse(clonedOtherRotation.simple.specRotationJson)),
			player.getSimpleRotation(),
		);
	} else {
		return APLRotation.equals(clonedOtherRotation, clonedRotation);
	}
};

export function prepullPotionAction(doAt?: string): APLPrepullAction {
	return APLPrepullAction.fromJsonString(
		`{"action":{"castSpell":{"spellId":{"otherId":"OtherActionPotion"}}},"doAtValue":{"const":{"val":"${doAt || '-1s'}"}}}`,
	);
}

export function autocastCooldownsAction(startAt?: string): APLAction {
	if (startAt) {
		return APLAction.fromJsonString(
			`{"condition":{"cmp":{"op":"OpGt","lhs":{"currentTime":{}},"rhs":{"const":{"val":"${startAt}"}}}},"autocastOtherCooldowns":{}}`,
		);
	} else {
		return APLAction.fromJsonString(`{"autocastOtherCooldowns":{}}`);
	}
}

export function scheduledCooldownAction(schedule: string, actionId: ActionIdProto): APLAction {
	return APLAction.fromJsonString(`{"schedule":{"schedule":"${schedule}","innerAction":{"castSpell":{"spellId":${ActionIdProto.toJsonString(actionId)}}}}}`);
}

export function simpleCooldownActions(cooldowns: Cooldowns): Array<APLAction> {
	return cooldowns.cooldowns
		.filter(cd => cd.id)
		.map(cd => {
			const schedule = cd.timings.map(timing => timing.toFixed(1) + 's').join(', ');
			return scheduledCooldownAction(schedule, cd.id!);
		});
}

export function standardCooldownDefaults(cooldowns: Cooldowns, prepotAt?: string, startAutocastCDsAt?: string): [Array<APLPrepullAction>, Array<APLAction>] {
	return [[prepullPotionAction(prepotAt)], [autocastCooldownsAction(startAutocastCDsAt), simpleCooldownActions(cooldowns)].flat()];
}
