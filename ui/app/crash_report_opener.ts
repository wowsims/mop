/** The seam `handleCrash` opens the crash report through: `individual_sim_ui` holds this, React subscribes to it. Same shape as `EpWeightsOpener`. */
export class CrashReportOpener {
	private link = '';
	private opened = false;
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getLink = (): string => this.link;

	readonly isOpen = (): boolean => this.opened;

	readonly open = (link: string): void => {
		this.link = link;
		this.opened = true;
		this.emit();
	};

	readonly setOpen = (open: boolean): void => {
		if (this.opened === open) return;
		this.opened = open;
		this.emit();
	};

	private emit() {
		for (const listener of this.listeners) listener();
	}
}
