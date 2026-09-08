/** @jsxImportSource @jsx-vanilla */
import { Spec } from '@generated/proto/common';
import { Player } from '@sim/player/player';
import { Database } from '@sim/proto/database';
import { Component } from '@ui-kit/component';
import type { ReactNode } from 'react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { registerSetBonusNotices } from '../item_notices';
import { ITEM_NOTICES, noticeElement } from './item_notices';

export type { ItemNoticeData, SetBonusNoticeData } from '../item_notices';

type ItemNoticeConfig = {
	itemId: number;
	additionalNoticeData?: ReactNode;
};

export class ItemNotice extends Component {
	itemId: number;
	player: Player<any>;
	tooltip: TippyInstance | null = null;
	additionalNoticeData: ItemNoticeConfig['additionalNoticeData'];
	constructor(player: Player<any>, config: ItemNoticeConfig) {
		super(null, 'item-notice');
		this.rootElem.classList.add('d-inline');
		this.itemId = config.itemId;
		this.player = player;
		this.additionalNoticeData = config.additionalNoticeData;

		if (this.hasNotice && this.template) this.rootElem.appendChild(this.template!);

		this.addOnDisposeCallback(() => {
			this.tooltip?.destroy();
			this.rootElem?.remove();
		});
	}

	get hasNotice() {
		return ITEM_NOTICES.has(this.itemId) || !!this.additionalNoticeData;
	}

	private get noticeContent(): ReactNode[] {
		if (!this.hasNotice) return [];
		const itemNotice = ITEM_NOTICES.get(this.itemId)!;
		const genericSpecItemNotice = itemNotice?.[Spec.SpecUnknown];
		const playerSpecItemNotice = itemNotice?.[this.player.getSpec()];

		const specNotices: ReactNode[] = [];

		if (playerSpecItemNotice) {
			specNotices.push(playerSpecItemNotice);
		} else if (genericSpecItemNotice) {
			specNotices.push(genericSpecItemNotice);
		}

		if (this.additionalNoticeData) specNotices.push(this.additionalNoticeData);

		return specNotices;
	}

	private get template() {
		const notices = this.noticeContent;
		if (!notices.length) return null;
		const noticeIconRef = ref<HTMLButtonElement>();
		const template = <button ref={noticeIconRef} className="warning fa fa-exclamation-triangle fa-xl me-2"></button>;

		let content: DocumentFragment | null = null;
		this.tooltip = tippy(noticeIconRef.value!, {
			// The notices become DOM on the first show, not here. `noticeElement` renders them through
			// React, and React defers a render started inside a commit — a bulk item picker builds its
			// `ItemRenderer` from an effect, and there the eager build handed tippy an empty fragment
			// with nothing logged in production. A show is always an event, never a commit.
			onShow: instance => {
				if (content) return;
				content = noticeElement(...notices);
				instance.setContent(content);
			},
		});

		return template;
	}

	static registerSetBonusNotices(db: Database) {
		registerSetBonusNotices(db);
	}
}
