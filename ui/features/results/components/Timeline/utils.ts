import type { SimResultData } from '../../model/result_data';

export type ChartView = 'rotation' | 'dps';

export const CHART_VIEWS: ReadonlyArray<ChartView> = ['rotation', 'dps'];

/**
 * A result the timeline has already drawn, as a string: two emits carrying the same run under the
 * same filter produce the same timeline, so rebuilding for the second is pure cost.
 */
export const resultKey = (resultData: SimResultData | null): string =>
	resultData ? [resultData.result.request.requestId, JSON.stringify(resultData.filter)].join('|') : '';
