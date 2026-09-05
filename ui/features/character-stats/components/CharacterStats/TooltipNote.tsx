/** A row with no value: the italic footnotes under the expertise and spell-hit breakdowns. */
export interface TooltipNoteProps {
	text: string;
}

export const TooltipNote = ({ text }: TooltipNoteProps) => (
	<div className="character-stats-tooltip-row">
		<span>
			<i>{text}</i>
		</span>
	</div>
);
