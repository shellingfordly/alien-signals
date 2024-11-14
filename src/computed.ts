import { Dependency, DirtyLevels, IComputed, Link, Subscriber, System } from './system.js';

// 计算值接口
export interface ISignal<T = any> {
	// 获取计算值
	get(): T;
}

// 创建计算值
export function computed<T>(getter: (cachedValue?: T) => T): ISignal<T> {
	// 创建计算值
	return new Computed<T>(getter);
}

// 计算值类
export class Computed<T = any> implements IComputed {
	// 缓存值
	cachedValue: T | undefined = undefined;

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
		public getter: (cachedValue?: T) => T
	) { }

	get(): T {
		// 获取脏标记
		let dirtyLevel = this.dirtyLevel;
		// 如果脏标记为MaybeDirty，则解析MaybeDirty
		if (dirtyLevel === DirtyLevels.MaybeDirty) {
			// 解析MaybeDirty
			Subscriber.resolveMaybeDirty(this);
			// 重新获取脏标记
			dirtyLevel = this.dirtyLevel;
		}
		// 如果脏标记为Dirty，则更新计算值
		if (dirtyLevel >= DirtyLevels.Dirty) {
			this.update();
		}
		// 获取当前活动的追踪ID
		const activeTrackId = System.activeTrackId;
		// 如果活动的追踪ID不为0，则链接计算值和当前活动的订阅者
		if (activeTrackId !== 0) {
			const subsTail = this.subsTail;
			if (subsTail === undefined || subsTail.trackId !== activeTrackId) {
				Dependency.link(this, System.activeSub!);
			}
		}
		return this.cachedValue!;
	}

	update(): void {
		// 开始追踪新的依赖
		const prevSub = Subscriber.startTrack(this);
		const oldValue = this.cachedValue;
		let newValue: T;
		try {
			// 执行计算函数
			newValue = this.getter(oldValue);
		} finally {
			// 结束依赖追踪
			Subscriber.endTrack(this, prevSub);
		}
		// 如果新值和旧值不相等，则更新缓存值
		if (oldValue !== newValue) {
			this.cachedValue = newValue;
			// 传播更新给订阅者
			const subs = this.subs;
			// 如果订阅者链表不为undefined，则传播更新
			if (subs !== undefined) {
				// 传播更新
				Dependency.propagate(subs);
			}
		}
	}
}
