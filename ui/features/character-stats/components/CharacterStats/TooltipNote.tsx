export interface TooltipNoteProps {
	text: string;
}

export const TooltipNote = ({ text }: TooltipNoteProps) => (
	<div className="character-stats-tooltip-row flex justify-between">
		<span>
			<i>{text}</i>
		</span>
	</div>
);
