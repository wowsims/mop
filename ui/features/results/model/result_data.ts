import { SimResult, SimResultFilter } from '@sim/proto_utils/sim_result';

export interface SimResultData {
	result: SimResult;
	filter: SimResultFilter;
}
