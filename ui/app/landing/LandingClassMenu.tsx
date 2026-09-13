import { Menu } from '@base-ui/react/menu';
import type { Class } from '@generated/proto/common';
import { translatePlayerClass, translatePlayerSpec, translateStatus } from '@i18n/localization';
import { PlayerClasses } from '@sim/player/classes/index';
import type { PlayerClass } from '@sim/player/player_class';
import { textClassNameForClass, textClassNameForSpec } from '@sim/proto/utils';
import { SimLinkContent } from '@ui-kit/SimLinkContent';
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
	// `null` is the "not resolved yet" value Base UI waits on; anything else falls back to `<body>`.
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const stacked = useMedia(STACKED, false);
	const className = translatePlayerClass(playerClass);

	return (
		<div className="dropend sim-link-dropdown" ref={setContainer}>
			<Menu.Root modal={false}>
				<Menu.Trigger openOnHover delay={0} className={clsx('sim-link', textClassNameForClass(playerClass))}>
					<SimLinkContent
						iconPath={playerClass.getIcon('large')}
						iconClassName={`border-${PlayerClasses.getCssScheme(playerClass)}`}
						title={className}
						status={translateStatus(classLaunchStatus(playerClass))}
					/>
				</Menu.Trigger>
				{/* `keepMounted`: the 34 spec links are the landing page's only content for a crawler, and an unmounted popup has none of them in the document. */}
				<Menu.Portal container={container} keepMounted>
					<Menu.Positioner
						side={stacked ? 'bottom' : 'right'}
						align="start"
						sideOffset={0}
						collisionPadding={4}
						className="landing-sim-link-positioner">
						<Menu.Popup className="landing-sim-link-popup">
							{Object.values(playerClass.specs).map(spec => (
								<Menu.LinkItem key={spec.simLink} href={spec.simLink} className={clsx('sim-link', textClassNameForSpec(spec))}>
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
