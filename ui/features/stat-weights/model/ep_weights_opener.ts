/** The seam the vanilla side opens the dialog through: `individual_sim_ui` and `reforge_panel` hold this, React subscribes to it. Same shape as `ImportExportRegistry`. */
export class EpWeightsOpener {
	private opened = false;
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly isOpen = (): boolean => this.opened;

	readonly open = (): void => this.setOpen(true);

	readonly setOpen = (open: boolean): void => {
		if (this.opened === open) return;
		this.opened = open;
		for (const listener of this.listeners) listener();
	};
}
