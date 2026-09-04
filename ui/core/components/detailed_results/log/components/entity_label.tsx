import type { Entity } from '../../../../proto_utils/combat_log';

export function EntityLabel(entity: Entity): JSX.Element {
	if (entity.isTarget) {
		return <span className="text-danger">[Target {entity.index + 1}]</span>;
	}

	if (entity.isPet) {
		return (
			<>
				<span className="text-primary">{`[${entity.ownerName} ${entity.index + 1}]`}</span>
				{` - `}
				{entity.name}
			</>
		);
	}

	return <span className="text-primary">{`[${entity.name} ${entity.index + 1}]`}</span>;
}
