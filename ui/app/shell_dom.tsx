/** @jsxImportSource @jsx-vanilla */
import i18n from '@i18n/config';
import { ref } from 'tsx-vanilla';

/**
 * The shell's skeleton, and the handles into it.
 *
 * Built in one place so that `SimUI` and `SimHeader` *adopt* elements rather than build them and
 * then re-find them with `querySelector`. That is the whole point of this step: once the markup is
 * a single function returning named handles, replacing it with a React component is a swap rather
 * than an excavation.
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
export const buildShellDom = (parent: HTMLElement, options: { noticeText?: string }): ShellDom => {
	const root = ref<HTMLDivElement>();
	const title = ref<HTMLDivElement>();
	const sidebarActions = ref<HTMLDivElement>();
	const sidebarResults = ref<HTMLDivElement>();
	const sidebarStats = ref<HTMLDivElement>();
	const sidebarSocials = ref<HTMLDivElement>();
	const content = ref<HTMLDivElement>();
	const main = ref<HTMLElement>();
	const header = ref<HTMLElement>();
	const tabsMount = ref<HTMLDivElement>();
	const toolbar = ref<HTMLDivElement>();

	parent.appendChild(
		<div ref={root}>
			<div className="sim-root">
				<div className="sim-bg" />
				{options.noticeText ? <div className="notices-banner alert border-bottom mb-0 text-center">{options.noticeText}</div> : null}
				<div className="sim-container">
					<aside className="sim-sidebar">
						<div ref={title} className="sim-title" />
						<div className="sim-sidebar-content">
							<div ref={sidebarActions} className="sim-sidebar-actions" />
							<div ref={sidebarResults} className="sim-sidebar-results" />
							<div ref={sidebarStats} className="sim-sidebar-stats" />
							<div ref={sidebarSocials} className="sim-sidebar-socials" />
						</div>
					</aside>
					<div ref={content} className="sim-content container-fluid">
						<header ref={header}>
							<div className="sim-header-container">
								<div ref={tabsMount} className="sim-tabs-mount" />
								<div className="import-export nav">
									<div className="dropdown sim-dropdown-menu import-dropdown">
										<button
											className="import-link"
											attributes={{ 'aria-expanded': 'false' }}
											dataset={{ bsToggle: 'dropdown', bsDisplay: 'dynamic' }}>
											<i className="fa fa-download"></i> {i18n.t('import.title')}
										</button>
										<ul className="dropdown-menu"></ul>
									</div>
									<div className="dropdown sim-dropdown-menu export-dropdown">
										<button
											className="export-link"
											attributes={{ 'aria-expanded': 'false' }}
											dataset={{ bsToggle: 'dropdown', bsDisplay: 'dynamic' }}>
											<i className="fa fa-right-from-bracket"></i> {i18n.t('export.title')}
										</button>
										<ul className="dropdown-menu"></ul>
									</div>
								</div>
								<div ref={toolbar} className="sim-toolbar nav"></div>
							</div>
						</header>
						<main ref={main} className="sim-main" />
					</div>
				</div>
			</div>
			<div className="sim-toast-container p-3 bottom-0 right-0" id="toastContainer" />
		</div>,
	);

	return {
		root: root.value!,
		title: title.value!,
		sidebarActions: sidebarActions.value!,
		sidebarResults: sidebarResults.value!,
		sidebarStats: sidebarStats.value!,
		sidebarSocials: sidebarSocials.value!,
		content: content.value!,
		main: main.value!,
		header: header.value!,
		tabsMount: tabsMount.value!,
		toolbar: toolbar.value!,
	};
};
