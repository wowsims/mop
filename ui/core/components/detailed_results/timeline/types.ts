import SecondaryResource from '../../../proto_utils/secondary_resource';
import { TypedEvent } from '../../../typed_event';
import { ResultComponentConfig } from '../result_component';
import { TimelineChartSpec } from './chart/types';
import { WindowedRow } from './windowed_row';

export interface TimelineConfig extends ResultComponentConfig {
	secondaryResource?: SecondaryResource | null;
}

export interface RotationSlot {
	key: string;
	labels: Array<Node>;
	timeline: Array<Node>;
	hiddenIdsNodes: Array<Node>;
	emitter: TypedEvent<void>;
	resetCallbacks: Array<() => void>;
	chartSpec: TimelineChartSpec | null;
	// Rows whose contents are populated from the horizontal scroll position.
	windowedRows: Array<WindowedRow>;
}
