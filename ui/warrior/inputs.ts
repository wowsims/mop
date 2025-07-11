import * as InputHelpers from '../core/components/input_helpers';
import { Spec } from '../core/proto/common';

// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

// Arms/Fury only

export const StanceSnapshot = <SpecType extends Spec.SpecArmsWarrior | Spec.SpecFuryWarrior>() =>
	InputHelpers.makeSpecOptionsBooleanInput<SpecType>({
		fieldName: 'stanceSnapshot',
		label: 'Stance Snapshot',
		labelTooltip: 'Ability that is cast at the same time as stance swap will benefit from the bonus of the stance before the swap.',
	});

