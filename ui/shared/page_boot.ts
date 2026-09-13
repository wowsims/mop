import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.color = 'white';

if (history.scrollRestoration) {
	history.scrollRestoration = 'manual';
} else {
	window.onbeforeunload = () => window.scrollTo(0, 0);
}

const markReady = () => document.body.classList.add('ready');

if (document.readyState === 'complete' || document.readyState === 'interactive') {
	setTimeout(markReady, 1);
} else {
	document.addEventListener('DOMContentLoaded', markReady);
}
