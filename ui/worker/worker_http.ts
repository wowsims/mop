import { BinaryReader } from '@protobuf-ts/runtime';

import { ASYNC_SIM_REQUESTS, SimRequest } from './types';
import { noop, sleep } from './utils';
import { HandlerFunction, WorkerInterface } from './worker_interface';

const defaultRequestOptions = {
	method: 'POST',
	headers: {
		'Content-Type': 'application/x-protobuf',
	},
};

// ProgressMetrics final_* field numbers (proto/api.proto), mirroring WorkerPool.isFinalProgress. Scanning tags avoids
// bundling every proto type into this worker; a field missed here only costs one extra poll.
const FINAL_PROGRESS_FIELDS = new Set([6, 7, 10, 11]);

const isFinalProgress = (progressMetrics: Uint8Array) => {
	const reader = new BinaryReader(progressMetrics);
	while (reader.pos < reader.len) {
		const [fieldNo, wireType] = reader.tag();
		if (FINAL_PROGRESS_FIELDS.has(fieldNo)) {
			return true;
		}
		reader.skip(wireType);
	}
	return false;
};

export const setupHttpWorker = (baseURL: string) => {
	const makeHttpApiRequest = (endPoint: string, inputData: Uint8Array, requestId: string) =>
		fetch(`${baseURL}/${endPoint}?requestId=${requestId}`, {
			...defaultRequestOptions,
			body: inputData as BodyInit,
		});

	const readHttpApiResponse = async (response: Response, endPoint: string) => {
		if (!response.ok) {
			const body = await response.text();
			throw new Error(`HTTP ${response.status} from /${endPoint}: ${body.slice(0, 200)}`);
		}

		const ab = await response.arrayBuffer();
		return new Uint8Array(ab);
	};

	const syncHandler: HandlerFunction = async (inputData, _, id, msg) => {
		const response = await makeHttpApiRequest(msg, inputData, id);
		return readHttpApiResponse(response, msg);
	};

	const asyncHandler: HandlerFunction = async (inputData, progress, id, msg) => {
		const asyncApiResult = await syncHandler(inputData, noop, id, msg);
		let outputData = new Uint8Array();
		while (true) {
			const progressResponse = await makeHttpApiRequest('asyncProgress', asyncApiResult, id);

			// If no new data available, stop querying.
			if ([204, 404].includes(progressResponse.status)) {
				break;
			}

			outputData = await readHttpApiResponse(progressResponse, 'asyncProgress');
			progress(outputData);
			if (isFinalProgress(outputData)) {
				break;
			}
			await sleep(50);
		}
		return outputData;
	};

	const noWasmConcurrency: HandlerFunction = (_, __, msg) => {
		const errmsg = `Tried to use ${msg} while using a http worker! This is only supported for wasm!`;
		console.error(errmsg);
		return new Uint8Array();
	};

	// Route every endpoint through the sync handler except the declared async ones, so a new
	// async endpoint only needs its ASYNC_SIM_REQUESTS entry to poll progress correctly.
	const handlers = Object.fromEntries(
		Object.values(SimRequest).map(request => [request, (ASYNC_SIM_REQUESTS as readonly SimRequest[]).includes(request) ? asyncHandler : syncHandler]),
	) as Record<SimRequest, HandlerFunction>;
	handlers[SimRequest.raidSimRequestSplit] = noWasmConcurrency;
	handlers[SimRequest.raidSimResultCombination] = noWasmConcurrency;

	new WorkerInterface(handlers).ready(false);
};
