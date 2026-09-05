/**
 * The shell's skeleton, and the handles into it.
 *
 * `SimUI` and `SimHeader` *adopt* these elements rather than build them and then re-find them with
 * `querySelector`. The markup itself is `SimShell.tsx`; this is only the contract between it and
 * the vanilla shell.
 *
 * Neither root carries its own class — `Component`'s `rootCssClass` still adds `sim-ui` and
 * `sim-header`, and `SimUI` still appends the rest of the list afterwards, so the class order on
 * the element is exactly what it was.
 */
export interface ShellDom {
	root: HTMLElement;
	title: HTMLElement;
	sidebarActions: HTMLElement;
	sidebarResults: HTMLElement;
	sidebarStats: HTMLElement;
	sidebarSocials: HTMLElement;
	content: HTMLElement;
	main: HTMLElement;
	header: HTMLElement;
	tabsMount: HTMLElement;
	toolbar: HTMLElement;
}

// `noticeText` is declared on `SimUIConfig` and supplied by nothing — the banner has never
// rendered. Kept rather than deleted, because removing a config field is not this commit's job.
