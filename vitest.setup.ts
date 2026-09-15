import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// The analytics snippet is loaded by index_template.html, so `gtag` exists in a real page but not
// here. Tab activation reports a page view, and an analytics call must never decide navigation.
(globalThis as unknown as { gtag: () => void }).gtag = () => {};
