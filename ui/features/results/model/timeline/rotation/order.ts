import type { RotationModel, Row } from './types';

// Every caller of the model's row index had `model.rows[model.byKey.get(key)!]` written out.
export function rowAt(model: RotationModel, key: string): Row {
	return model.rows[model.byKey.get(key)!];
}

export function computeOrder(model: RotationModel, hidden: ReadonlySet<string>): Array<string> {
	const order: Array<string> = [];
	for (const section of model.sections) {
		const visible = section.rowKeys.filter(key => !hidden.has(key));
		if (visible.length === 0) continue;
		if (section.separatorKey) order.push(section.separatorKey);
		if (section.headerKey) order.push(section.headerKey);
		for (const key of visible) order.push(key);
	}
	return order;
}
