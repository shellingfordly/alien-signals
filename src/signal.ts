import { ISignal } from './computed.js';
import { Dependency, endBatch, Link, startBatch, System } from './system.js';

// 可写信号
export interface IWritableSignal<T = any> extends ISignal<T> {
	set(value: T): void;
}

export function signal<T>(): Signal<T | undefined>;
export function signal<T>(oldValue: T): Signal<T>;
export function signal<T>(oldValue?: T): Signal<T | undefined> {
	return new Signal(oldValue);
}

export class Signal<T = any> implements Dependency {
	// 订阅者链表
	subs: Link | undefined = undefined;
	// 订阅者链表尾
	subsTail: Link | undefined = undefined;
	
	constructor(
		public currentValue: T
	) { }

	get(): NonNullable<T> {
		// 获取当前活动的追踪ID
		const activeTrackId = System.activeTrackId;
		// 如果当前活动的追踪ID不为0，则链接当前的依赖和当前活动的订阅者
		if (activeTrackId !== 0) {
			// 获取订阅者链表尾
			const subsTail = this.subsTail;
			// 如果订阅者链表尾为undefined，或者订阅者链表尾的追踪ID不等于当前活动的追踪ID，则链接当前的依赖和当前活动的订阅者
			if (subsTail === undefined || subsTail.trackId !== activeTrackId) {
				// 链接当前的依赖和当前活动的订阅者
				Dependency.link(this, System.activeSub!);
			}
		}
		// 返回当前值
		return this.currentValue!;
	}

	set(value: T): void {
		// 如果当前值不等于新值，则设置当前值
		if (this.currentValue !== (this.currentValue = value)) {
			// 获取订阅者链表
			const subs = this.subs;
			// 如果订阅者链表不为undefined，则开始批处理
			if (subs !== undefined) {
				// 开始批处理
				startBatch();
				// 传播依赖
				Dependency.propagate(subs);
				// 结束批处理
				endBatch();
			}
		}
	}
}
