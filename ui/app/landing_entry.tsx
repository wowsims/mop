import '../shared/page_boot';

import { updateLandingPageMetadata } from '@i18n/localization';
import { PortalContainerContext } from '@ui-kit/hooks/usePortalContainer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LandingPage } from './landing/LandingPage';

updateLandingPageMetadata();

const rootElem = document.getElementById('root');
if (!rootElem) throw new Error('No #root element on the page; ui/index.html should provide it.');

createRoot(rootElem).render(
	<StrictMode>
		<PortalContainerContext value={rootElem}>
			<LandingPage />
		</PortalContainerContext>
	</StrictMode>,
);
