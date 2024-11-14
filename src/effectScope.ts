import { DirtyLevels, Link, Subscriber, System } from './system.js';

// 当前活动的订阅者作用域
export let activeEffectScope: EffectScope | undefined = undefined;

// 创建订阅者作用域
export function effectScope(): EffectScope {
	// 创建订阅者作用域
	return new EffectScope();
}

// 订阅者作用域类
export class EffectScope implements Subscriber {
	// 依赖链表
	deps: Link | undefined = undefined;
	// 依赖链表尾
	depsTail: Link | undefined = undefined;
	// 追踪ID
	trackId: number = -(++System.lastTrackId);
	// 脏标记
	dirtyLevel: DirtyLevels = DirtyLevels.None;
	// 是否可以传播
	canPropagate = false;

	notify(): void {
		// 如果脏标记不为None，则将脏标记设置为None
		if (this.dirtyLevel !== DirtyLevels.None) {
			// 将脏标记设置为None
			this.dirtyLevel = DirtyLevels.None;
			// 遍历依赖链表
			let link = this.deps;
			// 遍历依赖链表
			while (link !== undefined) {
				// 获取依赖
				const dep = link.dep;
				if ('notify' in dep) {
					// 调用依赖的notify方法
					dep.notify();
				}
				// 移动到下一个依赖
				link = link.nextDep;
			}
		}
	}

	run<T>(fn: () => T): T {
		// 获取当前活动的订阅者作用域
		const prevSub = activeEffectScope;
		// 将当前的订阅者作用域设置为当前的订阅者作用域
		activeEffectScope = this;
		// 将追踪ID设置为正数
		this.trackId = Math.abs(this.trackId);
		try {
			// 执行函数
			return fn();
		} finally {
			// 将当前的订阅者作用域设置为之前的订阅者作用域
			activeEffectScope = prevSub;
			// 将追踪ID设置为负数
			this.trackId = -Math.abs(this.trackId);
		}
	}

	stop(): void {
		// 如果依赖链表不为undefined，则清除依赖链表
		if (this.deps !== undefined) {
			// 清除依赖链表
			Subscriber.clearTrack(this.deps);
			// 将依赖链表设置为undefined
			this.deps = undefined;
			// 将依赖链表尾设置为undefined
			this.depsTail = undefined;
		}
		// 将脏标记设置为None
		this.dirtyLevel = DirtyLevels.None;
	}
}
