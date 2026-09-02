type ResizeResult<TWorker> = {
	added: TWorker[];
	removed: TWorker[];
};

type WorkerPoolManagerConfig<TWorker> = {
	create: (index: number) => TWorker;
	getWorkAmount: (worker: TWorker) => number;
	enable?: (worker: TWorker, index: number) => void;
	disable?: (worker: TWorker, index: number) => void;
	destroy?: (worker: TWorker, index: number) => void;
};

export class WorkerPoolManager<TWorker> {
	private readonly workers: Array<TWorker | undefined> = [];
	private readonly disabledWorkers: Array<TWorker | undefined> = [];
	private readonly createWorker: WorkerPoolManagerConfig<TWorker>['create'];
	private readonly getWorkAmount: WorkerPoolManagerConfig<TWorker>['getWorkAmount'];
	private readonly enable?: WorkerPoolManagerConfig<TWorker>['enable'];
	private readonly disable?: WorkerPoolManagerConfig<TWorker>['disable'];
	private readonly destroy?: WorkerPoolManagerConfig<TWorker>['destroy'];

	constructor(config: WorkerPoolManagerConfig<TWorker>) {
		this.createWorker = config.create;
		this.getWorkAmount = config.getWorkAmount;
		this.enable = config.enable;
		this.disable = config.disable;
		this.destroy = config.destroy;
	}

	resize(numWorkers: number): ResizeResult<TWorker> {
		const nextWorkerCount = Math.max(1, numWorkers);
		const added: TWorker[] = [];
		const removed: TWorker[] = [];

		if (nextWorkerCount < this.workers.length) {
			for (let idx = this.workers.length - 1; idx >= nextWorkerCount; idx--) {
				const worker = this.workers[idx];
				if (!worker) continue;

				removed.push(worker);
				if (this.disable) {
					this.disable(worker, idx);
					this.disabledWorkers[idx] = worker;
				} else if (this.destroy) {
					this.destroy(worker, idx);
				}
			}
			this.workers.length = nextWorkerCount;
			return { added, removed };
		}

		for (let idx = 0; idx < nextWorkerCount; idx++) {
			if (this.workers[idx]) continue;

			if (this.enable && this.disabledWorkers[idx]) {
				const worker = this.disabledWorkers[idx]!;
				this.workers[idx] = worker;
				delete this.disabledWorkers[idx];
				this.enable(worker, idx);
				added.push(worker);
				continue;
			}

			const worker = this.createWorker(idx);
			this.workers[idx] = worker;
			added.push(worker);
		}

		return { added, removed };
	}

	getNumWorkers(): number {
		return this.workers.length;
	}

	getWorkers(): TWorker[] {
		return this.workers.filter((worker): worker is TWorker => !!worker);
	}

	hasWorker(predicate: (worker: TWorker) => boolean): boolean {
		return this.getWorkers().some(predicate);
	}

	getLeastBusyWorker(predicate?: (worker: TWorker) => boolean): TWorker {
		const workers = predicate ? this.getWorkers().filter(predicate) : this.getWorkers();
		if (workers.length === 0) {
			throw new Error('No workers available');
		}
		return workers.reduce((curMinWorker, nextWorker) => (this.getWorkAmount(curMinWorker) <= this.getWorkAmount(nextWorker) ? curMinWorker : nextWorker));
	}

	clear(): void {
		const destroy = this.destroy ?? this.disable;
		if (destroy) {
			this.getWorkers().forEach((worker, idx) => destroy(worker, idx));
			(this.disabledWorkers.filter(Boolean) as TWorker[]).forEach((worker, idx) => destroy(worker, idx));
		}
		this.workers.length = 0;
		this.disabledWorkers.length = 0;
	}
}
