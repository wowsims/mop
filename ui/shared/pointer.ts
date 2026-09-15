export const hasTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export const hasHover = () => window.matchMedia('(any-hover: hover)').matches;
