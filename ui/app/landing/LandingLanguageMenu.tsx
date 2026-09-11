import { Menu } from '@base-ui/react/menu';
import { getLang, setLang, supportedLanguages } from '@i18n/locale_service';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';

export const LandingLanguageMenu = () => {
	const currentLang = getLang();

	const selectLang = (lang: string) => {
		setLang(lang);
		window.location.reload();
	};

	return (
		<div className="nav-item dropdown">
			<Menu.Root modal={false}>
				<Menu.Trigger id="languageDropdown" className="nav-link dropdown-toggle" aria-label={supportedLanguages[currentLang]}>
					<Icon name="globe" size="2x" />
				</Menu.Trigger>
				<Menu.Portal keepMounted>
					<Menu.Positioner align="end" sideOffset={0} className="landing-language-positioner">
						<Menu.Popup className="landing-language-popup">
							{Object.entries(supportedLanguages).map(([code, name]) => (
								<Menu.Item
									key={code}
									render={<button type="button" />}
									className={clsx('dropdown-item', code === currentLang && 'active')}
									data-lang={code}
									onClick={() => selectLang(code)}>
									{name}
								</Menu.Item>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
		</div>
	);
};
