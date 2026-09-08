import SecondaryResource from '@sim/proto/secondary_resource';

import { ResultComponentConfig } from '../result_component';

export interface TimelineConfig extends ResultComponentConfig {
	secondaryResource?: SecondaryResource | null;
}
