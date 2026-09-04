import SecondaryResource from '@domain/proto_utils/secondary_resource';
import { Emitter } from '@domain/state/events';

import { ResultComponentConfig } from '../result_component';
import { WindowedRow } from './windowed_row';

export type TooltipHandler = (dataPointIndex: number) => Element;

export interface TimelineConfig extends ResultComponentConfig {
	secondaryResource?: SecondaryResource | null;
}

export interface RotationSlot {
	key: string;
	labels: Array<Node>;
	timeline: Array<Node>;
	hiddenIdsNodes: Array<Node>;
	emitter: Emitter<void>;
	resetCallbacks: Array<() => void>;
	plotOptions: any;
	// Rows whose contents are populated from the horizontal scroll position.
	windowedRows: Array<WindowedRow>;
}
