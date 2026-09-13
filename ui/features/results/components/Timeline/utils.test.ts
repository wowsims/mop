import { describe, expect, it } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { resultKey } from './utils';

const result = (requestId: string, filter: unknown) => ({ result: { request: { requestId } }, filter }) as SimResultData;

describe('resultKey', () => {
	it('separates two runs, and the same run under two filters', () => {
		expect(resultKey(result('a', { unit: 1 }))).toBe(resultKey(result('a', { unit: 1 })));
		expect(resultKey(result('a', { unit: 1 }))).not.toBe(resultKey(result('b', { unit: 1 })));
		expect(resultKey(result('a', { unit: 1 }))).not.toBe(resultKey(result('a', { unit: 2 })));
	});

	it('is empty before the first run', () => {
		expect(resultKey(null)).toBe('');
	});
});
