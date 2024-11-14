import { activeEffectScope } from './effectScope.js';
import { Dependency, DirtyLevels, IEffect, Link, Subscriber, System } from './system.js';

// 创建依赖
export function effect(fn: () => void): Effect<void> {
	// 创建依赖
	const e = new Effect(fn);
	// 执行依赖
	e.run();
	// 返回依赖
	return e;
}

// 依赖类
export class Effect<T = any> implements IEffect, Dependency {
	// 下一个通知
	nextNotify: IEffect | undefined = undefined;

	// 订阅者链表
	subs: Link | undefined = undefined;
	// 订阅者链表尾
	subsTail: Link | undefined = undefined;
	// 依赖链表
	deps: Link | undefined = undefined;
	// 依赖链表尾
	depsTail: Link | undefined = undefined;
	// 追踪ID
	trackId = 0;
	// 脏标记
	dirtyLevel: DirtyLevels = DirtyLevels.Dirty;
	// 是否可以传播
	canPropagate = false;

	constructor(
		public fn: () => T
	) {
		// 获取当前活动的追踪ID
		const activeTrackId = System.activeTrackId;
		// 如果活动的追踪ID不为0，则链接当前的依赖和当前活动的订阅者
		if (activeTrackId !== 0) {
			// 链接当前的依赖和当前活动的订阅者
			Dependency.link(this, System.activeSub!);
			return;
		}
		// 如果活动的订阅者作用域不为undefined，则链接当前的依赖和当前活动的订阅者
		if (activeEffectScope !== undefined) {
			const subsTail = this.subsTail;
			// 如果订阅者链表尾为undefined，或者订阅者链表尾的追踪ID不等于当前活动的订阅者作用域的追踪ID，则链接当前的依赖和当前活动的订阅者
			if (subsTail === undefined || subsTail.trackId !== activeEffectScope.trackId) {
				// 链接当前的依赖和当前活动的订阅者
				Dependency.link(this, activeEffectScope);
			}
		}
	}

	notify(): void {
		// 获取脏标记
		let dirtyLevel = this.dirtyLevel;
		// 如果脏标记大于None，则解析MaybeDirty
		if (dirtyLevel > DirtyLevels.None) {
			// 如果脏标记为MaybeDirty，则解析MaybeDirty
			if (dirtyLevel === DirtyLevels.MaybeDirty) {
				// 解析MaybeDirty
				Subscriber.resolveMaybeDirty(this);
				// 重新获取脏标记
				dirtyLevel = this.dirtyLevel;
			}
			// 如果脏标记为Dirty，则执行依赖函数
			if (dirtyLevel === DirtyLevels.Dirty) {
				// 执行依赖函数
				this.run();
			} else {
				// 将脏标记设置为None
				this.dirtyLevel = DirtyLevels.None;
				// 遍历依赖链表
				let link = this.deps;
				while (link !== undefined) {
					const dep = link.dep;
					// 如果依赖有notify方法，则调用notify方法
					if ('notify' in dep) {
						// 调用依赖的notify方法
						dep.notify();
					}
					// 移动到下一个依赖
					link = link.nextDep;
				}
			}
		}
	}

	run(): T {
		// 开始追踪依赖
		const prevSub = Subscriber.startTrack(this);
		try {
			// 执行依赖函数
			return this.fn();
		} finally {
			// 结束追踪依赖
			Subscriber.endTrack(this, prevSub);
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
		// 将脏标记设置为Dirty
		this.dirtyLevel = DirtyLevels.Dirty;
	}
}
