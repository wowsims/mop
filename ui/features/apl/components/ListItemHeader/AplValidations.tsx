import type { APLValidation } from '@generated/proto/api';
import { LogLevel } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { ListItemAction } from '@ui-kit/ListPicker';
import { Tooltip } from '@ui-kit/Tooltip';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface AplValidationsProps {
	/** The validations for this one list item, read fresh on every `currentStats` notification. */
	getValidations: (player: Player<any>) => Array<APLValidation>;
}

const DISPLAY = new Map<LogLevel, { icon: string; header: string }>([
	[LogLevel.Information, { icon: 'fa-info-circle', header: i18n.t('common.list_picker.additional_information') }],
	[LogLevel.Warning, { icon: 'fa-exclamation-triangle', header: i18n.t('common.list_picker.action_has_warnings') }],
	[LogLevel.Error, { icon: 'fa-exclamation-triangle', header: i18n.t('common.list_picker.action_has_errors') }],
]);

/** Written out rather than derived: `LogLevel` is a numeric enum, so iterating it yields the reverse mappings too. */
const LEVEL_CLASS = new Map<LogLevel, string>([
	[LogLevel.Undefined, 'apl-validation-undefined'],
	[LogLevel.Information, 'apl-validation-information'],
	[LogLevel.Warning, 'apl-validation-warning'],
	[LogLevel.Error, 'apl-validation-error'],
]);

interface Formatted {
	maxLogLevel: LogLevel;
	groups: Array<{ header?: string; messages: Array<string> }>;
}

/**
 * The item's validations, grouped by level and with every spell id resolved to its name.
 *
 * A message is text, never markup: the sim formats rotation-supplied group and variable names
 * straight into it, so it has to reach the tooltip as a text child and not as HTML.
 */
const format = async (validations: Array<APLValidation>): Promise<Formatted> => {
	const resolved = await Promise.all(validations.map(async entry => ({ ...entry, validation: await ActionId.replaceAllInString(entry.validation) })));
	const grouped = new Map<LogLevel, Array<string>>();
	let maxLogLevel = LogLevel.Undefined;
	for (const entry of resolved) {
		maxLogLevel = Math.max(entry.logLevel, maxLogLevel);
		const group = grouped.get(entry.logLevel);
		if (group) group.push(entry.validation);
		else grouped.set(entry.logLevel, [entry.validation]);
	}
	return { maxLogLevel, groups: Array.from(grouped, ([logLevel, messages]) => ({ header: DISPLAY.get(logLevel)?.header, messages })) };
};

/**
 * The warning triangle on an APL list item's header.
 *
 * The button is present but `display: none` while an item has nothing to say, which keeps the
 * header's element count stable. Formatting is asynchronous because a validation names spells by id
 * and `ActionId.replaceAllInString` resolves them.
 */
export const AplValidations = ({ getValidations }: AplValidationsProps) => {
	const player = usePlayer();
	const tooltipId = useId();
	const read = useRef(getValidations);
	read.current = getValidations;

	const subscribe = useMemo(() => subscribePlayerField(player, 'currentStats'), [player]);
	const validations = useStoreSubscribe(subscribe, () => read.current(player));

	const [formatted, setFormatted] = useState<Formatted | null>(null);
	useEffect(() => {
		if (!validations.length) {
			setFormatted(null);
			return;
		}
		let live = true;
		format(validations).then(next => {
			if (live) setFormatted(next);
		});
		return () => {
			live = false;
		};
	}, [validations]);

	const icon = formatted ? DISPLAY.get(formatted.maxLogLevel)?.icon : 'fa-exclamation-triangle';

	return (
		<>
			<ListItemAction
				icon={icon ?? ''}
				className={['apl-validations', formatted && LEVEL_CLASS.get(formatted.maxLogLevel)]}
				hidden={!formatted}
				tooltip={i18n.t('common.list_picker.warnings')}
				tooltipId={tooltipId}
			/>
			<Tooltip
				id={tooltipId}
				className="dropdown-tooltip"
				// `render` wins over the anchor's own `data-tooltip-content`, which is what the fallback branch hands back.
				render={({ content }) =>
					formatted
						? formatted.groups.map((group, index) => (
								<Fragment key={index}>
									<p>{group.header}</p>
									<ul>
										{group.messages.map((message, messageIndex) => (
											<li key={messageIndex}>{message}</li>
										))}
									</ul>
								</Fragment>
							))
						: content
				}
			/>
		</>
	);
};
