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
			className="navbar-toggler"
			type="button"
			aria-controls={COLLAPSE_ID}
			aria-expanded={open}
			aria-label={toggleLabel}
			onClick={() => setOpen(current => !current)}>
			<Icon name={icon} size="2x" />
		</button>
	);

	return (
		<header className="homepage-header">
			<div className="container homepage-header-container">
				<nav className="navbar navbar-dark navbar-expand-md flex-wrap align-items-end w-100">
					<div className="navbar-brand-container order-0">
						<a href="#" className="navbar-brand d-flex align-items-center p-0 m-0">
							<img className="wowsims-logo" src="/mop/assets/img/WoW-Simulator-Icon.png" alt="" />
							<div className="d-flex flex-column">
								<h2 className="wowsims-title">{i18n.t('landing.header.wowsims')}</h2>
								<h3 className="expansion-title w-100">{i18n.t('landing.header.expansion')}</h3>
							</div>
						</a>
						{toggler('bars')}
					</div>
					<div id={COLLAPSE_ID} className={clsx('collapse navbar-collapse homepage-header-collapse order-2 order-md-1', open && 'show')}>
						<div className="navbar-nav">
							{toggler('times')}
							<a href="https://discord.gg/p3DgvmnDCS" target="_blank" rel="noreferrer" className="nav-link link-alt">
								<p className="m-0">
									<Icon name="discord" style="brands" size="2x" className="discord-link" />
									&nbsp;
								</p>
							</a>
							<a href="https://github.com/wowsims/mop" target="_blank" rel="noreferrer" className="nav-link link-alt">
								<p className="m-0">
									<Icon name="github" style="brands" size="2x" className="github-link" />
									&nbsp;
								</p>
							</a>
							<a href="https://patreon.com/wowsims" target="_blank" rel="noreferrer" className="nav-link link-alt">
								<Icon name="patreon" style="brands" size="2x" className="patreon-link me-2" />
								<span className="fs-4 d-md-none d-lg-block">{i18n.t('landing.header.supportDevs')}</span>
							</a>
							<LandingLanguageMenu />
						</div>
					</div>
				</nav>
			</div>
		</header>
	);
};
