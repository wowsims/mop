import type { Entity } from '@sim/proto/combat_log';

export interface EntityLabelProps {
	entity: Entity;
}

export const EntityLabel = ({ entity }: EntityLabelProps) => {
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
};
