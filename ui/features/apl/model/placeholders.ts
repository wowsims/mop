import type { APLGroup, APLRotation } from '@generated/proto/apl';
import { renameAPLReference } from '@sim/proto/apl_utils';

/**
 * Depth-first walk over a proto message's own object graph, `visit` first.
 *
 * Returning `true` from `visit` stops the walk.
 */
export const visitObjects = (node: unknown, visit: (obj: any) => boolean | void): boolean => {
	if (!node || typeof node !== 'object') return false;
	if (visit(node)) return true;
	const children = Array.isArray(node) ? node : Object.values(node);
	return children.some(child => visitObjects(child, visit));
};

const isPlaceholder = (obj: any): obj is { value: { variablePlaceholder: { name?: string } } } => obj?.value?.oneofKind === 'variablePlaceholder';

/** The group whose actions contain `target`, by identity. */
export const findContainingGroup = (rotation: APLRotation | undefined, target: unknown): APLGroup | undefined =>
	rotation?.groups?.find(group => (group.actions || []).some(action => visitObjects(action, obj => obj === target)));

/** Every placeholder name used inside a group, in first-seen order. */
export const placeholderNames = (group: APLGroup | undefined): Array<string> => {
	const names = new Set<string>();
	(group?.actions || []).forEach(action =>
		visitObjects(action, obj => {
			const name = isPlaceholder(obj) ? obj.value.variablePlaceholder?.name : undefined;
			if (name) names.add(name);
		}),
	);
	return Array.from(names);
};

/**
 * Renames a placeholder inside its own group, and re-points every group reference that passes a
 * variable of that name to the group.
 *
 * Scoped to the one group deliberately: two groups may each define a placeholder called `target`
 * and they are unrelated.
 */
export const renamePlaceholder = (rotation: APLRotation, group: APLGroup, oldName: string, newName: string) => {
	renameAPLReference(group, { type: 'placeholder', oldName, newName });
	visitObjects(rotation, obj => {
		if (obj?.oneofKind !== 'groupReference' || obj.groupReference?.groupName !== group.name) return;
		for (const variable of obj.groupReference.variables ?? []) {
			if (variable.name === oldName) variable.name = newName;
		}
	});
};

/** Empties the `APLValue` holding `placeholder`, which is how a cancelled "new placeholder" undoes itself. */
export const clearPlaceholder = (rotation: APLRotation, placeholder: unknown): boolean =>
	visitObjects(rotation, obj => {
		if (!isPlaceholder(obj) || obj.value.variablePlaceholder !== placeholder) return;
		(obj as { value: unknown }).value = { oneofKind: undefined };
		return true;
	});
