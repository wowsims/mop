import { Menu } from '@base-ui/react/menu';
import type { Class } from '@generated/proto/common';
import { translatePlayerClass, translatePlayerSpec, translateStatus } from '@i18n/localization';
import { PlayerClasses } from '@sim/player/classes/index';
import type { PlayerClass } from '@sim/player/player_class';
import { textClassNameForClass, textClassNameForSpec } from '@sim/proto/utils';
import { SimLinkContent } from '@ui-kit/SimLinkContent';
import { CLASS_BORDER } from '@ui-kit/utils/colors';
import clsx from 'clsx';
import { useState } from 'react';
import { useMedia } from 'react-use';

import { classLaunchStatus } from './landing_classes';

// `media-breakpoint-down(lg)`, where `_homepage.scss` drops the class list to one or two columns.
// Below it there is no room beside a row, so the menu opens under it instead.
const STACKED = '(max-width: 991.98px)';

export interface LandingClassMenuProps {
	playerClass: PlayerClass<Class>;
}

export const LandingClassMenu = ({ playerClass }: LandingClassMenuProps) => {
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const stacked = useMedia(STACKED, false);
	const className = translatePlayerClass(playerClass);

	return (
		<div className="ui-landing-sim-link-dropdown" ref={setContainer} data-testid="sim-link-dropdown">
			<Menu.Root modal={false}>
				<Menu.Trigger openOnHover delay={0} className={clsx('ui-landing-sim-link-cell', textClassNameForClass(playerClass))} data-testid="sim-link">
					<SimLinkContent
						iconPath={playerClass.getIcon('large')}
						iconClassName={CLASS_BORDER[PlayerClasses.getCssScheme(playerClass)]}
						title={className}
						status={translateStatus(classLaunchStatus(playerClass))}
					/>
				</Menu.Trigger>
				{/* `keepMounted`: the 34 spec links are the landing page's only content for a crawler, and an unmounted popup has none of them in the document. */}
				<Menu.Portal container={container} keepMounted>
					<Menu.Positioner side={stacked ? 'bottom' : 'right'} align="start" sideOffset={0} collisionPadding={4} className="z-dropdown">
						<Menu.Popup className="ui-landing-sim-link-popup">
							{Object.values(playerClass.specs).map(spec => (
								<Menu.LinkItem
									key={spec.simLink}
									href={spec.simLink}
									className={clsx('ui-landing-sim-link-cell', textClassNameForSpec(spec))}
									data-testid="sim-link">
									<SimLinkContent
										iconPath={spec.getIcon('large')}
										label={className}
										title={translatePlayerSpec(spec)}
										status={translateStatus(spec.launch.status)}
									/>
								</Menu.LinkItem>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
		</div>
	);
};
