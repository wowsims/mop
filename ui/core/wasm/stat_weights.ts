import {
	ErrorOutcome,
	ErrorOutcomeType,
	ProgressMetrics,
	StatWeightsCalcRequest,
	StatWeightsRequest,
	StatWeightsResult,
	StatWeightsStatResultData,
} from '../proto/api';
import { SimSignals } from '../sim_signal_manager';
import { isDevMode } from '../utils';
import { WorkerPool, WorkerProgressCallback, generateRequestId } from '../worker_pool';
import { SimRequest } from '../../worker/types';
import { runConcurrentSim } from './sim';

const makeAndSendWeightsError = (err: string | ErrorOutcome, onProgress: WorkerProgressCallback): StatWeightsResult => {
	const errRes = StatWeightsResult.create();
	if (typeof err === 'string') {
		console.error(err);
		errRes.error = ErrorOutcome.create({ message: err });
	} else {
		console.error(err.message);
		errRes.error = err;
	}
	onProgress(ProgressMetrics.create({ finalWeightResult: errRes }));
	return errRes;
};

export const runConcurrentStatWeights = async (
	request: StatWeightsRequest,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
): Promise<StatWeightsResult> => {
	if (isDevMode()) {
		console.log('Getting stat weight sim requests.');
	}

	const newRaidSimRequestId = () => generateRequestId(SimRequest.raidSimAsync);

	const manualResponse = await workerPool.statWeightRequests(request);
	manualResponse.baseRequest!.requestId = newRaidSimRequestId();

	if (signals.abort.isTriggered()) {
		return makeAndSendWeightsError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);
	}

	let iterationsTotal = manualResponse.baseRequest!.simOptions!.iterations;
	let iterationsDone = 0;
	let simsTotal = 1;
	let simsDone = 0;

	for (const statReqData of manualResponse.statSimRequests) {
		iterationsTotal += statReqData.requestLow!.simOptions!.iterations + statReqData.requestHigh!.simOptions!.iterations;
		simsTotal += 2;
	}

	if (isDevMode()) {
		console.log(`Need to run a total of ${simsTotal} sims and ${iterationsTotal} iterations.`);
	}

	let lastIterations = 0;
	const progressHandler = (pm: ProgressMetrics) => {
		iterationsDone += pm.completedIterations - lastIterations;
		lastIterations = pm.completedIterations;

		onProgress(
			ProgressMetrics.create({
				totalIterations: iterationsTotal,
				completedIterations: iterationsDone,
				totalSims: simsTotal,
				completedSims: simsDone,
			}),
		);

		if (pm.finalRaidResult) simsDone++;
	};

	const baseLine = await runConcurrentSim(manualResponse.baseRequest!, workerPool, progressHandler, signals);
	if (baseLine.error) return makeAndSendWeightsError(baseLine.error, onProgress);

	const calcRequest = StatWeightsCalcRequest.create({
		baseResult: baseLine,
		epReferenceStat: manualResponse.epReferenceStat,
		statSimResults: [],
	});

	for (const statReqData of manualResponse.statSimRequests) {
		if (signals.abort.isTriggered()) return makeAndSendWeightsError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);

		lastIterations = 0;
		statReqData.requestLow!.requestId = newRaidSimRequestId();
		const lowRes = await runConcurrentSim(statReqData.requestLow!, workerPool, progressHandler, signals);
		if (lowRes.error) return makeAndSendWeightsError(lowRes.error, onProgress);

		lastIterations = 0;
		statReqData.requestHigh!.requestId = newRaidSimRequestId();
		const highRes = await runConcurrentSim(statReqData.requestHigh!, workerPool, progressHandler, signals);
		if (highRes.error) return makeAndSendWeightsError(highRes.error, onProgress);

		calcRequest.statSimResults.push(
			StatWeightsStatResultData.create({
				statData: statReqData.statData,
				resultLow: lowRes,
				resultHigh: highRes,
			}),
		);
	}

	if (isDevMode()) {
		console.log(`All ${simsTotal} sims finished successfully. Computing weights.`);
	}

	const weightResult = await workerPool.statWeightCompute(calcRequest);
	if (weightResult.error) return makeAndSendWeightsError(weightResult.error, onProgress);
	onProgress(ProgressMetrics.create({ finalWeightResult: weightResult }));
	return weightResult;
};
