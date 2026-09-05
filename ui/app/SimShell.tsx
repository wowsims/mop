import i18n from '@i18n/config';
import { type RefObject, useLayoutEffect, useRef } from 'react';

import type { ShellDom } from './shell_dom';

export interface SimShellProps {
	/** Filled in a layout effect, before `SimApp`'s own effect constructs the shell into it. */
	domRef: RefObject<ShellDom | null>;
	noticeText?: string;
}

/**
 * The sim's skeleton — everything parent to the tabs. It renders **once** and is never re-rendered:
 * `SimApp` holds the element in a `useMemo`, which is load-bearing three times over.
 *
 * - Every container here is filled imperatively afterwards. React must not own their children, and
 *   a re-render that re-created any of these nodes would take the vanilla content with it.
 * - Bootstrap rewrites `aria-expanded` on the dropdown toggles and `.show` on their menus. React
 *   diffs against its own last props rather than the DOM, so a re-render with identical props is
 *   already safe — but not re-rendering at all makes that independent of React's bail-out rules.
 * - `sticky_toolbar.ts` measures `.sim-header`'s `offsetHeight` while the tabs are constructed, so
 *   the header has to be laid out in this first render, not a later one.
 *
 * Neither root carries a `className`: `Component`'s `rootCssClass` still adds `sim-ui` and
 * `sim-header`, and `SimUI` appends the rest of the list. That list becomes React's in its own
 * commit — mixing the two would drop whatever vanilla added on the next render.
 */
export const SimShell = ({ domRef, noticeText }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const title = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
	const sidebarResults = useRef<HTMLDivElement>(null);
	const sidebarStats = useRef<HTMLDivElement>(null);
	const sidebarSocials = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const main = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const tabsMount = useRef<HTMLDivElement>(null);
	const toolbar = useRef<HTMLDivElement>(null);

	// A child's layout effect runs before its parent's, which is what lets `SimApp` construct
	// against a populated bundle in the very same commit.
	useLayoutEffect(() => {
		domRef.current = {
			root: root.current!,
			title: title.current!,
			sidebarActions: sidebarActions.current!,
			sidebarResults: sidebarResults.current!,
			sidebarStats: sidebarStats.current!,
			sidebarSocials: sidebarSocials.current!,
			content: content.current!,
			main: main.current!,
			header: header.current!,
			tabsMount: tabsMount.current!,
			toolbar: toolbar.current!,
		};
	}, [domRef]);

	return (
		<div ref={root}>
			<div className="sim-root">
				<div className="sim-bg" />
				{noticeText ? <div className="notices-banner alert border-bottom mb-0 text-center">{noticeText}</div> : null}
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
										{/* Literal, not derived: Bootstrap owns this attribute once the plugin takes over. */}
										<button className="import-link" aria-expanded="false" data-bs-toggle="dropdown" data-bs-display="dynamic">
											<i className="fa fa-download" /> {i18n.t('import.title')}
										</button>
										<ul className="dropdown-menu" />
									</div>
									<div className="dropdown sim-dropdown-menu export-dropdown">
										<button className="export-link" aria-expanded="false" data-bs-toggle="dropdown" data-bs-display="dynamic">
											<i className="fa fa-right-from-bracket" /> {i18n.t('export.title')}
										</button>
										<ul className="dropdown-menu" />
									</div>
								</div>
								<div ref={toolbar} className="sim-toolbar nav" />
							</div>
						</header>
						<main ref={main} className="sim-main" />
					</div>
				</div>
			</div>
			<div className="sim-toast-container p-3 bottom-0 right-0" id="toastContainer" />
		</div>
	);
};
