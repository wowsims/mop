import { SimResult, SimResultFilter } from '@domain/proto_utils/sim_result';

export interface SimResultData {
	result: SimResult;
	filter: SimResultFilter;
}
