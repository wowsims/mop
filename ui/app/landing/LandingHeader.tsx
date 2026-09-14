import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useState } from 'react';

import { LandingLanguageMenu } from './LandingLanguageMenu';

const COLLAPSE_ID = 'homepageHeaderCollapse';

export const LandingHeader = () => {
	const [open, setOpen] = useState(false);
	const toggleLabel = i18n.t('landing.navigation.toggle');

	const toggler = (icon: 'bars' | 'times') => (
		<button
			className="border-0 text-white py-1 px-3 leading-none text-lg md:hidden max-md:absolute max-md:top-0 max-md:right-0"
			type="button"
			aria-controls={COLLAPSE_ID}
			aria-expanded={open}
			aria-label={toggleLabel}
			data-testid="navbar-toggler"
			onClick={() => setOpen(current => !current)}>
			<Icon name={icon} size="2x" />
		</button>
	);

	return (
		<header>
			<div className="w-full max-w-full px-3 lg:max-w-landing-lg lg:mx-auto xl:max-w-modal-xl xxl:max-w-landing-xxl h-full flex pt-section max-md:pb-4">
				<nav className="flex flex-wrap items-end w-full relative justify-between md:justify-start py-2">
					<div className="flex order-0 max-md:w-full max-md:justify-between max-md:items-end">
						<a href="#" className="flex items-center p-0 m-0 whitespace-nowrap text-lg text-white">
							<img className="w-24 mr-4 max-md:w-12" src="/mop/assets/img/WoW-Simulator-Icon.png" alt="" />
							<div className="flex flex-col">
								<h2 className="text-fluid-5xl font-bold text-brand m-0 leading-none" data-testid="wowsims-title">
									{i18n.t('landing.header.wowsims')}
								</h2>
								<h3 className="w-full text-expansion m-0" data-testid="expansion-title">
									{i18n.t('landing.header.expansion')}
								</h3>
							</div>
						</a>
						{toggler('bars')}
					</div>
					<div
						id={COLLAPSE_ID}
						className={clsx(
							'order-2 md:order-1 grow basis-full items-end justify-end pt-4 pb-4 md:flex md:basis-auto max-md:fixed max-md:inset-0 max-md:p-4 max-md:bg-black-90 max-md:z-dropdown',
							!open && 'hidden',
						)}>
						<div className="flex flex-col md:flex-row max-md:relative max-md:items-start" data-testid="navbar-nav">
							{toggler('times')}
							<a
								href="https://discord.gg/p3DgvmnDCS"
								target="_blank"
								rel="noreferrer"
								className="ui-landing-nav-link flex items-center whitespace-nowrap text-sm py-4 px-0 md:px-2 max-md:pt-2">
								<p className="m-0">
									<Icon name="discord" style="brands" size="2x" />
									&nbsp;
								</p>
							</a>
							<a
								href="https://github.com/wowsims/mop"
								target="_blank"
								rel="noreferrer"
								className="ui-landing-nav-link flex items-center whitespace-nowrap text-sm py-4 px-0 md:px-2">
								<p className="m-0">
									<Icon name="github" style="brands" size="2x" />
									&nbsp;
								</p>
							</a>
							<a
								href="https://patreon.com/wowsims"
								target="_blank"
								rel="noreferrer"
								className="ui-landing-nav-link flex items-center whitespace-nowrap text-sm py-4 px-0 md:px-2">
								<Icon name="patreon" style="brands" size="2x" className="mr-2" />
								<span className="text-fluid-xl md:hidden lg:block">{i18n.t('landing.header.supportDevs')}</span>
							</a>
							<LandingLanguageMenu />
						</div>
					</div>
				</nav>
			</div>
		</header>
	);
};
