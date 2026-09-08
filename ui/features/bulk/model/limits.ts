import { NATIVE_COMBINATIONS_LIMIT, NATIVE_ITERATIONS_LIMIT, WEB_COMBINATIONS_LIMIT, WEB_ITERATIONS_LIMIT } from '@sim/bulk/types';
import { isExternal } from '@ui-kit/utils/dom';

/**
 * The ceiling this host is allowed. `sim.isNative` is resolved asynchronously, so until it answers
 * the hostname decides: a page served from wowsims.com is the web sim and gets the low limit, and
 * anything else is assumed to be a local binary. Once the probe resolves it wins outright — the
 * heuristic is a first guess, never a correction to it.
 */
export const bulkLimitForHost = (isNative: boolean | undefined, webLimit: number, nativeLimit: number): number => {
	if (isNative === undefined) return isExternal() ? webLimit : nativeLimit;
	return isNative ? nativeLimit : webLimit;
};

export const bulkIterationsLimit = (isNative: boolean | undefined): number => bulkLimitForHost(isNative, WEB_ITERATIONS_LIMIT, NATIVE_ITERATIONS_LIMIT);

export const bulkCombinationsLimit = (isNative: boolean | undefined): number => bulkLimitForHost(isNative, WEB_COMBINATIONS_LIMIT, NATIVE_COMBINATIONS_LIMIT);
