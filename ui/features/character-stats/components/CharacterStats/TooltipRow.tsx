export interface TooltipRowProps {
	label: string;
	value: string;
}

export const TooltipRow = ({ label, value }: TooltipRowProps) => (
	<div className="character-stats-tooltip-row flex justify-between">
		<span className="mr-2">{label}</span>
		<span>{value}</span>
	</div>
);
