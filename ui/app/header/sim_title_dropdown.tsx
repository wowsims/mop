import { PlayerClass } from '@domain/player_class';
import { PlayerClasses } from '@domain/player_classes/index';
import { PlayerSpec } from '@domain/player_spec';
import { PlayerSpecs } from '@domain/player_specs/index';
import { textCssClassForClass, textCssClassForSpec } from '@domain/proto_utils/utils';
import { Class } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translatePlayerClass, translatePlayerSpec, translateStatus } from '@i18n/localization';
import { Component } from '@ui-kit/component';
import clsx from 'clsx';
import { ref } from 'tsx-vanilla';


interface ClassOptions {
	type: 'Class';
	class: PlayerClass<Class>;
}

interface SpecOptions {
	type: 'Spec';
	spec: PlayerSpec<any>;
}

// Dropdown menu for selecting a player.
export class SimTitleDropdown extends Component {
	private readonly dropdownMenu: HTMLElement | undefined;

	constructor(parent: HTMLElement, currentSpec: PlayerSpec<any>) {
		super(parent, 'sim-title-dropdown-root');

		const rootLink = this.buildRootSimLink({ type: 'Spec', spec: currentSpec });

		const dropdownMenuRef = ref<HTMLUListElement>();
		this.rootElem.replaceChildren(
			<div className="dropdown sim-link-dropdown">
				{rootLink}
				<ul ref={dropdownMenuRef} className="dropdown-menu"></ul>
			</div>,
		);

		this.dropdownMenu = dropdownMenuRef.value!;
		this.buildDropdown();

		// Prevent Bootstrap from closing the menu instead of opening class menus
		this.dropdownMenu.addEventListener('click', event => {
			const target = event.target as HTMLElement;
			const link = target.closest('a');

			if (!link) {
				event.stopPropagation();
				event.preventDefault();
			}
		});
	}

	private buildDropdown() {
		PlayerClasses.naturalOrder.forEach(klass => this.dropdownMenu?.appendChild(<li>{this.buildClassDropdown(klass)}</li>));
	}

	private buildClassDropdown(klass: PlayerClass<Class>) {
		return (
			<div className="dropend sim-link-dropdown">
				{this.buildClassLink(klass)}
				<ul className="dropdown-menu">
					{Object.values(klass.specs).map(spec => (
						<li>{this.buildSpecLink(spec)}</li>
					))}
				</ul>
			</div>
		);
	}

	private buildRootSimLink(data: SpecOptions) {
		return (
			<button
				className={clsx('sim-link', this.getContextualKlass(data))}
				dataset={{ bsToggle: 'dropdown', bsTrigger: 'click' }}
				attributes={{ 'aria-expanded': 'false' }}>
				<div className="sim-link-content">
					<img src={this.getSimIconPath(data)} className="sim-link-icon" />
					<div className="d-flex flex-column">
						<span className="sim-link-label text-white">{i18n.t('sidebar.header.title')}</span>
						<span className="sim-link-title">{PlayerSpecs.getFullSpecName(data.spec)}</span>
						{this.launchStatusLabel(data)}
					</div>
				</div>
			</button>
		);
	}

	private buildClassLink(klass: PlayerClass<Class>) {
		return (
			<button
				className={clsx('sim-link', this.getContextualKlass({ type: 'Class', class: klass }))}
				dataset={{ bsToggle: 'dropdown' }}
				attributes={{ 'aria-expanded': 'false' }}>
				<div className="sim-link-content">
					<img src={this.getSimIconPath({ type: 'Class', class: klass })} className="sim-link-icon" />
					<div className="d-flex flex-column">
						<span className="sim-link-title">{translatePlayerClass(klass)}</span>
					</div>
				</div>
			</button>
		);
	}

	private buildSpecLink(spec: PlayerSpec<any>) {
		return (
			<a
				href={new URL(spec.simLink, window.location.href).toString()}
				className={clsx('sim-link', this.getContextualKlass({ type: 'Spec', spec: spec }))}>
				<div className="sim-link-content">
					<img src={this.getSimIconPath({ type: 'Spec', spec: spec })} className="sim-link-icon" />
					<div className="d-flex flex-column">
						<span className="sim-link-label">{translatePlayerClass(PlayerSpecs.getPlayerClass(spec))}</span>
						<span className="sim-link-title">{translatePlayerSpec(spec)}</span>
						{this.launchStatusLabel({ type: 'Spec', spec: spec })}
					</div>
				</div>
			</a>
		);
	}

	private launchStatusLabel(data: SpecOptions) {
		const status = data.spec.launch.status;
		const phase = data.spec.launch.phase;

		return (
			<span className="launch-status-label text-brand">
				{i18n.t('sidebar.header.phase', {
					phase: i18n.t(`common.phases.${phase}`),
					status: translateStatus(status),
				})}
			</span>
		);
	}

	private getSimIconPath(data: ClassOptions | SpecOptions): string {
		let iconPath = '';
		switch (data.type) {
			case 'Class':
				iconPath = data.class.getIcon('large');
				break;
			case 'Spec':
				iconPath = data.spec.getIcon('large');
				break;
		}
		return iconPath;
	}

	private getContextualKlass(data: ClassOptions | SpecOptions): string {
		switch (data.type) {
			case 'Class':
				return textCssClassForClass(data.class);
			case 'Spec':
				return textCssClassForSpec(data.spec);
		}
	}
}
