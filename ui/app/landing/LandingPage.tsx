import i18n from '@i18n/config';
import { PlayerClasses } from '@sim/player/classes/index';

import { LANDING_CLASS_ORDER } from './landing_classes';
import { LandingClassMenu } from './LandingClassMenu';
import { LandingHeader } from './LandingHeader';

export const LandingPage = () => (
	<>
		<div className="homepage-image" />
		<div id="homepage">
			<LandingHeader />
			<main>
				<div className="container homepage-content-container">
					<div className="info-container">
						<p id="description" className="wowsims-info">
							{i18n.t('landing.home.welcomeDescription')}
						</p>
					</div>
					<div className="sim-links-container">
						<div className="sim-links" id="sim-links">
							{LANDING_CLASS_ORDER.map(classId => (
								<LandingClassMenu key={classId} playerClass={PlayerClasses.fromProto(classId)} />
							))}
						</div>
					</div>
				</div>
			</main>
		</div>
	</>
);
