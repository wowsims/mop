export interface TooltipNoteProps {
	text: string;
}

export const TooltipNote = ({ text }: TooltipNoteProps) => (
	<div data-testid="character-stats-tooltip-row" className="flex justify-between">
		<span>
			<i>{text}</i>
		</span>
	</div>
);
