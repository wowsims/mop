/** @jsxImportSource @jsx-vanilla */
import { REPO_CHOOSE_NEW_ISSUE_URL, REPO_RELEASES_URL } from '@domain/constants/other';
import { noop } from '@domain/utils';
import { Exporter } from '@features/import-export/view/exporter';
import { Importer } from '@features/import-export/view/importer';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { isNative } from '@ui-kit/dom_utils';
import { SimToolbarItem } from '@ui-kit/sim_toolbar_item';
import clsx from 'clsx';
import tippy, { ReferenceElement as TippyReferenceElement } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { trackPageView } from '../../tracking/analytics';
import { SettingsMenu } from '../settings_menu';
import type { ShellDom } from '../shell_dom';
import { SimUI } from '../sim_ui';
import { SocialLinks } from './social_links';

interface ToolbarLinkArgs {
	parent: HTMLElement;
	href?: string;
	text?: string;
	icon?: string;
	tooltip?: string | HTMLElement;
	classes?: string;
	onclick?: () => void;
}

export class SimHeader extends Component {
	private simUI: SimUI;

	readonly simTabsContainer: HTMLElement;
	private simToolbar: HTMLElement;
	private knownIssuesLink: TippyReferenceElement<HTMLElement>;
	private knownIssuesContent: HTMLUListElement;

	constructor(dom: ShellDom, simUI: SimUI) {
		// Adopted from the shell bundle. No `rootCssClass`: the header's class list, `.stuck`
		// included, is React's (app/SimShell.tsx).
		super(null, undefined, dom.header);
		this.simUI = simUI;
		this.simTabsContainer = dom.tabsMount;
		this.simToolbar = dom.toolbar;

		this.knownIssuesContent = (<ul className="text-start ps-3 mb-0"></ul>) as HTMLUListElement;
		this.knownIssuesLink = this.addKnownIssuesLink();
		this.addBugReportLink();
		this.addDownloadBinaryLink();
		this.addSimOptionsLink();
		this.addSocialLinks();
	}

	// Tab identifiers double as a class name on the tab button, which is what callers pass.
	activateTab(className: string) {
		this.simUI.tabs.activate(className);
	}

	addImportLink(label: string, importer: Importer, isUnsupported = false) {
		this.addImportExportLink('.import-dropdown', label, importer, isUnsupported);
	}
	addExportLink(label: string, exporter: Exporter, isUnsupported = false) {
		this.addImportExportLink('.export-dropdown', label, exporter, isUnsupported);
	}
	private addImportExportLink(cssClass: string, label: string, importerExporter: Importer | Exporter, isUnsupported?: boolean) {
		const dropdownElem = this.rootElem.querySelector<HTMLElement>(cssClass)!;
		const menuElem = dropdownElem.querySelector<HTMLElement>('.dropdown-menu')!;
		const buttonRef = ref<HTMLButtonElement>();

		menuElem.appendChild(
			<li>
				<button ref={buttonRef} className={clsx('dropdown-item', isUnsupported && 'disabled')}>
					{label}
				</button>
			</li>,
		);
		if (buttonRef.value) {
			if (isUnsupported) {
				tippy(buttonRef.value, { content: 'Currently unsupported' });
				return;
			}
			buttonRef.value.addEventListener('click', () => importerExporter.open());
		}
	}

	private addToolbarLink({ parent, tooltip, classes, onclick, text, ...itemArgs }: ToolbarLinkArgs): HTMLElement {
		const itemRef = ref<HTMLAnchorElement>();
		parent.appendChild(
			<SimToolbarItem linkRef={itemRef} buttonClassName={classes} {...itemArgs}>
				{text}
			</SimToolbarItem>,
		);

		if (onclick) itemRef.value!.addEventListener('click', onclick);
		if (tooltip)
			tippy(itemRef.value!, {
				content: tooltip,
				placement: 'bottom',
			});
		return itemRef.value!;
	}

	private addKnownIssuesLink() {
		return this.addToolbarLink({
			parent: this.simToolbar,
			text: i18n.t('info.known_issues'),
			tooltip: this.knownIssuesContent,
			classes: 'known-issues link-danger hide',
		});
	}

	addKnownIssue(issue: string) {
		const listItem = (<li></li>) as HTMLLIElement;
		// Using innerHTML here because the issue text can contain stringified HTML
		listItem.innerHTML = issue;
		this.knownIssuesContent.appendChild(listItem);

		this.knownIssuesLink.classList.remove('hide');
		this.knownIssuesLink._tippy?.setContent(this.knownIssuesContent);
	}

	private addBugReportLink() {
		this.addToolbarLink({
			href: REPO_CHOOSE_NEW_ISSUE_URL,
			parent: this.simToolbar,
			icon: 'fas fa-bug fa-lg',
			tooltip: i18n.t('info.bug_report'),
		});
	}

	private addDownloadBinaryLink() {
		const href = REPO_RELEASES_URL;
		const icon = 'fas fa-gauge-high fa-lg';
		const parent = this.simToolbar;

		if (isNative()) {
			fetch('/version')
				.then(resp => {
					resp.json()
						.then(versionInfo => {
							if (versionInfo.outdated == 2) {
								this.addToolbarLink({
									href: href,
									parent: parent,
									icon: icon,
									tooltip: 'Newer version of simulator available for download',
									classes: 'downbin link-danger',
								});
							}
						})
						.catch(_error => {
							console.warn('No version info found!');
						});
				})
				.catch(noop);
		} else {
			this.addToolbarLink({
				href: href,
				parent: parent,
				icon: icon,
				tooltip: 'Download simulator for faster simulating',
				classes: 'downbin',
			});
		}
	}

	private addSimOptionsLink() {
		const settingsMenu = new SettingsMenu(this.simUI.rootElem, this.simUI);
		this.addToolbarLink({
			parent: this.simToolbar,
			icon: 'fas fa-cog fa-lg',
			tooltip: i18n.t('info.sim_options'),
			classes: 'sim-options',
			onclick: () => {
				trackPageView('Options', '/settings-menu');
				settingsMenu.open();
			},
		});
	}

	private addSocialLinks() {
		const container = (<div className="sim-toolbar-socials" />) as HTMLElement;
		this.simToolbar.appendChild(container);

		this.addDiscordLink(container);
		this.addGitHubLink(container);
		this.addPatreonLink(container);
	}

	private addDiscordLink(container: HTMLElement) {
		container.appendChild(<SimToolbarItem>{SocialLinks.buildDiscordLink()}</SimToolbarItem>);
	}

	private addGitHubLink(container: HTMLElement) {
		container.appendChild(<SimToolbarItem>{SocialLinks.buildGitHubLink()}</SimToolbarItem>);
	}

	private addPatreonLink(container: HTMLElement) {
		container.appendChild(<SimToolbarItem>{SocialLinks.buildPatreonLink()}</SimToolbarItem>);
	}
}
