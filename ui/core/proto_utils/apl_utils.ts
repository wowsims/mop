import { Player } from '../player';
import { APLAction, APLPrepullAction, APLRotation, APLRotation_Type } from '../proto/apl.js';
import { ActionID as ActionIdProto, Cooldowns, Spec } from '../proto/common.js';

type APLRenameTarget =
	| { type: 'variable'; oldName: string; newName: string }
	| { type: 'placeholder'; oldName: string; newName: string }
	| { type: 'group'; oldName: string; newName: string };

/**
 * Recursively walks an APL rotation object and renames all references to a variable, placeholder, or group.
 * Matches on oneofKind discriminators (variableRef, variablePlaceholder, groupReference)
 * so it never needs updating when new action/value types are added to the proto.
 */
export function renameAPLReference(obj: unknown, target: APLRenameTarget): void {
	if (!obj || typeof obj !== 'object') return;

	if (Array.isArray(obj)) {
		for (const item of obj) renameAPLReference(item, target);
		return;
	}

	const record = obj as Record<string, unknown>;

	if (target.type === 'variable') {
		if (record.oneofKind === 'variableRef') {
			const ref = record.variableRef as Record<string, unknown>;
			if (ref?.name === target.oldName) ref.name = target.newName;
			return; // Leaf node
		}
		// variableRef can appear inside groupReference variable values — keep traversing
		if (record.oneofKind === 'variablePlaceholder') {
			return; // Not affected by variable renames
		}
	}

	if (target.type === 'placeholder') {
		if (record.oneofKind === 'variablePlaceholder') {
			const ph = record.variablePlaceholder as Record<string, unknown>;
			if (ph?.name === target.oldName) ph.name = target.newName;
			return; // Leaf node
		}
		// groupReference.variables[] entries have names that map to placeholders
		if (record.oneofKind === 'groupReference') {
			const gr = record.groupReference as Record<string, unknown>;
			if (Array.isArray(gr?.variables)) {
				for (const v of gr.variables as Array<Record<string, unknown>>) {
					if (v.name === target.oldName) v.name = target.newName;
				}
			}
			// Keep traversing — nested values could contain more placeholders
		}
		if (record.oneofKind === 'variableRef') {
			return; // Not affected by placeholder renames
		}
	}

	if (target.type === 'group') {
		if (record.oneofKind === 'groupReference') {
			const gr = record.groupReference as Record<string, unknown>;
			if (gr?.groupName === target.oldName) gr.groupName = target.newName;
			return; // No nested group references inside a group reference
		}
	}

	for (const value of Object.values(record)) {
		renameAPLReference(value, target);
	}
}

export const isEqualAPLRotation = (player: Player<Spec>, rotation?: APLRotation, otherRotation?: APLRotation): boolean => {
	if (!!rotation != !!otherRotation) return false;

	const clonedRotation = rotation ? APLRotation.clone(rotation) : undefined;
	const clonedOtherRotation = otherRotation ? APLRotation.clone(otherRotation) : undefined;
	// Ensure that the auto rotation type can be matched
	if (clonedRotation?.type === APLRotation_Type.TypeAuto) clonedRotation.type = APLRotation_Type.TypeAPL;
	if (clonedOtherRotation?.type === APLRotation_Type.TypeAuto) clonedOtherRotation.type = APLRotation_Type.TypeAPL;
	if (clonedOtherRotation?.type === APLRotation_Type.TypeSimple && clonedOtherRotation?.simple?.specRotationJson) {
		return (
			!!clonedRotation?.simple &&
			player.specTypeFunctions.rotationEquals(
				player.specTypeFunctions.rotationFromJson(JSON.parse(clonedOtherRotation.simple.specRotationJson)),
				player.specTypeFunctions.rotationFromJson(JSON.parse(clonedRotation.simple.specRotationJson)),
			)
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
