import { SimResult, SimResultFilter } from '@sim/proto/sim_result';

export interface SimResultData {
	result: SimResult;
	filter: SimResultFilter;
}
