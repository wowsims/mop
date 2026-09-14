import i18n from '@i18n/config';
import { PlayerClasses } from '@sim/player/classes/index';

import { LANDING_CLASS_ORDER } from './landing_classes';
import { LandingClassMenu } from './LandingClassMenu';
import { LandingHeader } from './LandingHeader';

export const LandingPage = () => (
	<>
		<div className="fixed w-full h-full bg-landing bg-no-repeat bg-cover bg-center -z-1 opacity-30" />
		<div id="homepage" className="h-full flex flex-col">
			<LandingHeader />
			<main>
				<div className="w-full max-w-full px-3 lg:max-w-landing-lg lg:mx-auto xl:max-w-modal-xl xxl:max-w-landing-xxl h-full flex flex-col pt-page pb-page max-md:mb-4">
					<div className="mb-page flex flex-col max-md:mb-4">
						<p id="description" className="text-fluid-xl w-3/4 m-0 max-lg:w-full">
							{i18n.t('landing.home.welcomeDescription')}
						</p>
					</div>
					<div className="flex flex-col max-lg:-mx-4">
						<div className="flex flex-wrap" id="sim-links">
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
