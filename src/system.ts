// 依赖接口
export interface IEffect extends Subscriber {
	// 下一个通知
	nextNotify: IEffect | undefined;
	// 通知
	notify(): void;
}

// 计算值
export interface IComputed extends Dependency, Subscriber {
	update(): void;
}

// 依赖
export interface Dependency {
	// 订阅者链表
	subs: Link | undefined;
	// 订阅者链表尾
	subsTail: Link | undefined;
}

// 订阅者
export interface Subscriber {
	// 追踪ID
	trackId: number;
	// 是否可以传播
	canPropagate: boolean;
	// 脏标记
	dirtyLevel: DirtyLevels;
	// 依赖链表
	deps: Link | undefined;
	// 依赖链表尾
	depsTail: Link | undefined;
}

// 链接	
export interface Link {
	// 依赖
	dep: Dependency | IComputed | (Dependency & IEffect);
	// 订阅者
	sub: Subscriber | IComputed | IEffect;
	// 追踪ID
	trackId: number;
	// 前一个订阅者
	prevSub: Link | undefined;
	// 下一个订阅者
	nextSub: Link | undefined;
	// 下一个依赖
	nextDep: Link | undefined;
}

export const enum DirtyLevels {
	// 无
	None,
	// 仅副作用
	SideEffectsOnly,
	// 可能脏
	MaybeDirty,
	// 脏
	Dirty,
}


export namespace System {
	// 当前活动的订阅者
	export let activeSub: Subscriber | undefined = undefined;
	// 当前活动的追踪ID
	export let activeTrackId = 0;
	// 批处理深度
	export let batchDepth = 0;
	// 最后一个追踪ID
	export let lastTrackId = 0;
	// 待处理的副作用
	export let queuedEffects: IEffect | undefined = undefined;
	// 待处理的副作用尾
	export let queuedEffectsTail: IEffect | undefined = undefined;
}

// 开始批处理
export function startBatch(): void {
	// 批处理深度加1
	System.batchDepth++;
}

// 结束批处理
export function endBatch(): void {
	// 批处理深度减1
	System.batchDepth--;
	// 如果批处理深度为0，则遍历待处理的副作用
	if (System.batchDepth === 0) {
		// 遍历待处理的副作用
		while (System.queuedEffects !== undefined) {
			// 获取待处理的副作用
			const effect = System.queuedEffects;
			// 获取下一个待处理的副作用
			const queuedNext = System.queuedEffects.nextNotify;
			// 如果下一个待处理的副作用不为undefined，则设置当前待处理的副作用的下一个待处理的副作用为undefined，并将当前待处理的副作用设置为下一个待处理的副作用
			if (queuedNext !== undefined) {
				// 设置当前待处理的副作用的下一个待处理的副作用为undefined
				System.queuedEffects.nextNotify = undefined;
				// 将当前待处理的副作用设置为下一个待处理的副作用
				System.queuedEffects = queuedNext;
			} else {
				// 将待处理的副作用设置为undefined
				System.queuedEffects = undefined;
				// 将待处理的副作用尾设置为undefined
				System.queuedEffectsTail = undefined;
			}
			// 执行待处理的副作用的notify方法
			effect.notify();
		}
	}
}

export namespace Link {
	// 链接池
	let pool: Link | undefined = undefined;

	// 获取链接
	export function get(dep: Dependency, sub: Subscriber, nextDep: Link | undefined): Link {
		// 如果链接池不为undefined，则从链接池中获取链接
		if (pool !== undefined) {
			// 获取链接
			const newLink = pool;
			// 从链接池中获取链接
			pool = newLink.nextDep;
			// 设置链接的下一个依赖
			newLink.nextDep = nextDep;
			// 设置链接的依赖
			newLink.dep = dep;
			// 设置链接的订阅者
			newLink.sub = sub;
			// 设置链接的追踪ID
			newLink.trackId = sub.trackId;
			return newLink;
		} else {
			// 创建新的链接
			return {
				dep,
				sub,
				trackId: sub.trackId,
				nextDep: nextDep,
				prevSub: undefined,
				nextSub: undefined,
			};
		}
	}

	export function release(link: Link): void {
		// 获取链接的依赖
		const dep = link.dep;
		// 获取链接的下一个订阅者
		const nextSub = link.nextSub;
		// 获取链接的前一个订阅者
		const prevSub = link.prevSub;

		// 如果下一个订阅者不为undefined，则设置下一个订阅者的前一个订阅者为当前链接的前一个订阅者
		if (nextSub !== undefined) {
			nextSub.prevSub = prevSub;
		}
		// 如果前一个订阅者不为undefined，则设置前一个订阅者的下一个订阅者为当前链接的下一个订阅者
		if (prevSub !== undefined) {
			prevSub.nextSub = nextSub;
		}

		// 如果下一个订阅者为undefined，则设置依赖的订阅者链表尾为当前链接的前一个订阅者
		if (nextSub === undefined) {
			dep.subsTail = prevSub;
		}
		// 如果前一个订阅者为undefined，则设置依赖的订阅者链表为当前链接的下一个订阅者
		if (prevSub === undefined) {
			dep.subs = nextSub;
		}

		// @ts-expect-error
		// 设置链接的依赖为undefined
		link.dep = undefined;
		// @ts-expect-error
		// 设置链接的订阅者为undefined
		link.sub = undefined;
		// 设置链接的前一个订阅者为undefined
		link.prevSub = undefined;
		// 设置链接的下一个订阅者为undefined
		link.nextSub = undefined;
		// 设置链接的下一个依赖为链接池
		link.nextDep = pool;
		// 将链接设置为链接池
		pool = link;
	}
}

export namespace Dependency {

	const system = System;

	/**
	 * @deprecated 使用link代替
	 */
	export function linkSubscriber(dep: Dependency, sub: Subscriber): void {
		return link(dep, sub);
	}

	// 链接订阅者依赖
	export function link(dep: Dependency, sub: Subscriber): void {
		// 获取订阅者依赖链表尾
		const depsTail = sub.depsTail;
		// 获取订阅者依赖链表尾的下一个依赖
		const old = depsTail !== undefined
			? depsTail.nextDep
			: sub.deps;
		// 如果旧的依赖为undefined，或者旧的依赖的依赖不为当前依赖，则创建新的链接
		if (old === undefined || old.dep !== dep) {
			// 创建新的链接
			const newLink = Link.get(dep, sub, old);

			// 如果订阅者依赖链表尾为undefined，则设置订阅者依赖链表为新的链接
			if (depsTail === undefined) {
				// 设置订阅者依赖链表为新的链接
				sub.deps = newLink;
			} else {
				// 设置订阅者依赖链表尾的下一个依赖为新的链接
				depsTail.nextDep = newLink;
			}

			// 如果依赖的订阅者链表为undefined，则设置依赖的订阅者链表为新的链接
			if (dep.subs === undefined) {
				// 设置依赖的订阅者链表为新的链接
				dep.subs = newLink;
			} else {
				// 获取依赖的订阅者链表尾
				const oldTail = dep.subsTail!;
				// 设置新的链接的前一个订阅者为依赖的订阅者链表尾
				newLink.prevSub = oldTail;
				// 设置依赖的订阅者链表尾的下一个订阅者为新的链接
				oldTail.nextSub = newLink;
			}

			// 设置订阅者依赖链表尾为新的链接
			sub.depsTail = newLink;
			// 设置依赖的订阅者链表尾为新的链接
			dep.subsTail = newLink;
		} else {
			// 设置旧的依赖的追踪ID为订阅者的追踪ID
			old.trackId = sub.trackId;
			// 设置订阅者依赖链表尾为旧的依赖
			sub.depsTail = old;
		}
	}

	// 传播依赖
	export function propagate(subs: Link): void {
		// 获取订阅者链表
		let link: Link | undefined = subs;
		// 获取订阅者链表的依赖
		let dep = subs.dep;
		// 脏标记
		let dirtyLevel = DirtyLevels.Dirty;
		// 剩余数量
		let remainingQuantity = 0;

		do {
			// 如果链接不为undefined，则获取链接的订阅者
			if (link !== undefined) {
				// 获取链接的订阅者
				const sub: Link['sub'] = link.sub;
				// 获取订阅者的追踪ID
				const subTrackId = sub.trackId;

				// 如果订阅者的追踪ID大于0
				if (subTrackId > 0) {
					// 如果订阅者的追踪ID等于链接的追踪ID
					if (subTrackId === link.trackId) {
						// 获取订阅者的脏标记
						const subDirtyLevel = sub.dirtyLevel;
						// 如果订阅者的脏标记小于当前脏标记
						if (subDirtyLevel < dirtyLevel) {
							// 设置订阅者的脏标记为当前脏标记
							sub.dirtyLevel = dirtyLevel;
							// 如果订阅者的脏标记为None
							if (subDirtyLevel === DirtyLevels.None) {
								// 设置订阅者可以传播
								sub.canPropagate = true;
								// 如果订阅者有订阅者链表
								if ('subs' in sub && sub.subs !== undefined) {
									// 设置订阅者依赖链表尾的下一个依赖为当前链接
									sub.depsTail!.nextDep = link;
									// 设置依赖为订阅者
									dep = sub;
									// 设置链接为订阅者的订阅者链表
									link = sub.subs;
									// 如果订阅者有notify方法
									if ('notify' in sub) {
										// 设置脏标记为副作用仅
										dirtyLevel = DirtyLevels.SideEffectsOnly;
									} else {
										// 设置脏标记为可能脏
										dirtyLevel = DirtyLevels.MaybeDirty;
									}
									// 剩余数量加1
									remainingQuantity++;
									// 继续循环
									continue;
								}
							}
						}
					}
				} else if (subTrackId === -link.trackId) {
					// 获取订阅者的脏标记
					const subDirtyLevel = sub.dirtyLevel;
					// 如果订阅者的脏标记为None
					const notDirty = subDirtyLevel === DirtyLevels.None;
					// 如果订阅者的脏标记小于当前脏标记
					if (subDirtyLevel < dirtyLevel) {
						// 设置订阅者的脏标记为当前脏标记
						sub.dirtyLevel = dirtyLevel;
					}

					// 如果订阅者的脏标记为None，或者订阅者可以传播
					if (notDirty || sub.canPropagate) {
						// 如果订阅者的脏标记不为None
						if (!notDirty) {
							// 设置订阅者不可以传播
							sub.canPropagate = false;
						}
						// 如果订阅者有订阅者链表
						if ('subs' in sub && sub.subs !== undefined) {
							// 设置订阅者依赖链表尾的下一个依赖为当前链接
							sub.depsTail!.nextDep = link;
							// 设置依赖为订阅者
							dep = sub;
							// 设置链接为订阅者的订阅者链表
							link = sub.subs;
							// 如果订阅者有notify方法
							if ('notify' in sub) {
								// 设置脏标记为副作用仅
								dirtyLevel = DirtyLevels.SideEffectsOnly;
							} else {
								// 设置脏标记为可能脏
								dirtyLevel = DirtyLevels.MaybeDirty;
							}
							// 剩余数量加1
							remainingQuantity++;

							continue;
						} else if ('notify' in sub) {
							// 获取待处理的副作用尾
							const queuedEffectsTail = system.queuedEffectsTail;
							// 如果待处理的副作用尾不为undefined，则设置待处理的副作用尾的下一个待处理的副作用为订阅者
							if (queuedEffectsTail !== undefined) {
								// 设置待处理的副作用尾的下一个待处理的副作用为订阅者
								queuedEffectsTail.nextNotify = sub;
							} else {
								// 设置待处理的副作用为订阅者
								system.queuedEffects = sub;
							}
							// 设置待处理的副作用尾为订阅者
							system.queuedEffectsTail = sub;
						}
					}
				}

				// 设置链接为订阅者的下一个订阅者
				link = link.nextSub;
				continue;
			}

			// 如果剩余数量不为0
			if (remainingQuantity !== 0) {
				// 获取依赖的订阅者链表尾
				const depsTail = (dep as IComputed | IEffect).depsTail!;
				// 获取依赖的订阅者链表尾的下一个依赖
				const prevLink = depsTail.nextDep!;
				// 获取依赖的订阅者链表尾的下一个依赖的订阅者
				const prevSub = prevLink.sub;

				// 设置依赖的订阅者链表尾的下一个依赖为undefined
				depsTail.nextDep = undefined;
				// 设置依赖为依赖的订阅者链表尾的下一个依赖
				dep = prevLink.dep;
				// 设置链接为依赖的订阅者链表尾的下一个依赖的下一个订阅者
				link = prevLink.nextSub;
				// 剩余数量减1
				remainingQuantity--;

				// 如果剩余数量为0
				if (remainingQuantity === 0) {
					// 设置脏标记为脏
					dirtyLevel = DirtyLevels.Dirty;
				} else if ('notify' in dep) {
					// 设置脏标记为副作用仅
					dirtyLevel = DirtyLevels.SideEffectsOnly;
				} else {
					dirtyLevel = DirtyLevels.MaybeDirty;
				}

				// 如果订阅者有notify方法
				if ('notify' in prevSub) {
					// 获取待处理的副作用尾
					const queuedEffectsTail = system.queuedEffectsTail;
					// 如果待处理的副作用尾不为undefined，则设置待处理的副作用尾的下一个待处理的副作用为订阅者
					if (queuedEffectsTail !== undefined) {
						// 设置待处理的副作用尾的下一个待处理的副作用为订阅者
						queuedEffectsTail.nextNotify = prevSub;
					} else {
						// 设置待处理的副作用为订阅者
						system.queuedEffects = prevSub;
					}
					// 设置待处理的副作用尾为订阅者
					system.queuedEffectsTail = prevSub;
				}

				continue;
			}

			break;
		} while (true);
	}
}

export namespace Subscriber {

	const system = System;

	// 解析可能脏
	export function resolveMaybeDirty(sub: IComputed | IEffect, depth = 0): void {
		// 获取订阅者依赖链表
		let link = sub.deps;

		while (link !== undefined) {
			const dep = link.dep;
			if ('update' in dep) {
				// 获取依赖的脏标记
				let dirtyLevel = dep.dirtyLevel;

				// 如果依赖的脏标记为可能脏
				if (dirtyLevel === DirtyLevels.MaybeDirty) {
					// 如果深度大于等于4，则递归解析可能脏
					if (depth >= 4) {
						// 非递归解析可能脏
						resolveMaybeDirtyNonRecursive(dep);
					} else {
						// 递归解析可能脏
						resolveMaybeDirty(dep, depth + 1);
					}
					// 重新获取依赖的脏标记
					dirtyLevel = dep.dirtyLevel;
				}
				// 如果依赖的脏标记为脏
				if (dirtyLevel === DirtyLevels.Dirty) {
					// 执行依赖的更新方法
					dep.update();
					// 如果订阅者的脏标记为脏
					if (sub.dirtyLevel === DirtyLevels.Dirty) {
						// 退出循环
						break;
					}
				}
			}
			// 设置链接为依赖的下一个依赖
			link = link.nextDep;
		}

		// 如果订阅者的脏标记为可能脏
		if (sub.dirtyLevel === DirtyLevels.MaybeDirty) {
			// 设置订阅者的脏标记为None
			sub.dirtyLevel = DirtyLevels.None;
		}
	}

	// 非递归解析可能脏
	export function resolveMaybeDirtyNonRecursive(sub: IComputed | IEffect): void {
		// 获取订阅者依赖链表
		let link = sub.deps;
		// 剩余数量
		let remaining = 0;

		do {
			// 如果链接不为undefined
			if (link !== undefined) {
				// 获取链接的依赖
				const dep = link.dep;

				// 如果依赖有update方法
				if ('update' in dep) {
					// 获取依赖的脏标记
					const depDirtyLevel = dep.dirtyLevel;

					// 如果依赖的脏标记为可能脏
					if (depDirtyLevel === DirtyLevels.MaybeDirty) {
						// 设置链接的前一个订阅者为当前链接
						dep.subs!.prevSub = link;
						// 设置依赖为当前依赖
						sub = dep;
						// 设置链接为依赖的依赖链表
						link = dep.deps;
						// 剩余数量加1
						remaining++;
						// 继续循环
						continue;
					} else if (depDirtyLevel === DirtyLevels.Dirty) {
						// 执行依赖的更新方法
						dep.update();
						// 如果订阅者的脏标记为脏
						if (sub.dirtyLevel === DirtyLevels.Dirty) {
							// 如果剩余数量不为0
							if (remaining !== 0) {
								// 获取订阅者依赖链表
								const subSubs = (sub as IComputed).subs!;
								// 获取订阅者依赖链表尾的前一个订阅者
								const prevLink = subSubs.prevSub!;
								// 执行订阅者的更新方法
								(sub as IComputed).update();
								// 设置订阅者依赖链表尾的前一个订阅者为undefined
								subSubs.prevSub = undefined;
								// 设置订阅者为依赖的订阅者链表尾的前一个订阅者
								sub = prevLink.sub as IComputed | IEffect;
								// 设置链接为依赖的订阅者链表尾的前一个订阅者的下一个依赖
								link = prevLink.nextDep;
								// 剩余数量减1
								remaining--;
								// 继续循环
								continue;
							}
							// 退出循环
							break;
						}
					}
				}

				// 设置链接为依赖的下一个依赖
				link = link.nextDep;
				// 继续循环
				continue;
			}

			// 获取订阅者的脏标记
			const dirtyLevel = sub.dirtyLevel;

			// 如果订阅者的脏标记为可能脏
			if (dirtyLevel === DirtyLevels.MaybeDirty) {
				// 设置订阅者的脏标记为None
				sub.dirtyLevel = DirtyLevels.None;
				// 如果剩余数量不为0
				if (remaining !== 0) {
					// 获取订阅者依赖链表
					const subSubs = (sub as IComputed).subs!;
					// 获取订阅者依赖链表尾的前一个订阅者
					const prevLink = subSubs.prevSub!;
					// 设置订阅者依赖链表尾的前一个订阅者为undefined
					subSubs.prevSub = undefined;
					// 设置订阅者为依赖的订阅者链表尾的前一个订阅者的下一个依赖
					sub = prevLink.sub as IComputed | IEffect;
					// 设置链接为依赖的订阅者链表尾的前一个订阅者的下一个依赖
					link = prevLink.nextDep;
					// 剩余数量减1
					remaining--;
					// 继续循环
					continue;
				}
			} else if (remaining !== 0) {
				// 如果订阅者的脏标记为脏
				if (dirtyLevel === DirtyLevels.Dirty) {
					// 执行订阅者的更新方法
					(sub as IComputed).update();
				}
				// 获取订阅者依赖链表
				const subSubs = (sub as IComputed).subs!;
				// 获取订阅者依赖链表尾的前一个订阅者
				const prevLink = subSubs.prevSub!;
				// 设置订阅者依赖链表尾的前一个订阅者为undefined
				subSubs.prevSub = undefined;
				// 设置订阅者为依赖的订阅者链表尾的前一个订阅者的下一个依赖
				sub = prevLink.sub as IComputed | IEffect;
				// 设置链接为依赖的订阅者链表尾的前一个订阅者的下一个依赖
				link = prevLink.nextDep;
				// 剩余数量减1
				remaining--;
				// 继续循环
				continue;
			}

			break;
		} while (true);
	}

	/**
	 * @deprecated Use `startTrack` instead.
	 */
	export function startTrackDependencies(sub: Subscriber): Subscriber | undefined {
		// 开始追踪依赖
		return startTrack(sub);
	}

	/**
	 * @deprecated Use `endTrack` instead.
	 */
	export function endTrackDependencies(sub: Subscriber, prevSub: Subscriber | undefined): void {
		// 结束追踪依赖
		return endTrack(sub, prevSub);
	}

	// 开始追踪依赖
	export function startTrack(sub: Subscriber): Subscriber | undefined {
		// 获取新的追踪ID
		const newTrackId = system.lastTrackId + 1;
		// 获取当前活动的订阅者
		const prevSub = system.activeSub;

		// 设置当前活动的订阅者为当前订阅者
		system.activeSub = sub;
		// 设置当前活动的追踪ID为新的追踪ID
		system.activeTrackId = newTrackId;
		// 设置最后一个追踪ID为新的追踪ID
		system.lastTrackId = newTrackId;

		// 设置订阅者依赖链表尾为undefined
		sub.depsTail = undefined;
		// 设置订阅者的追踪ID为新的追踪ID
		sub.trackId = newTrackId;
		// 设置订阅者的脏标记为None
		sub.dirtyLevel = DirtyLevels.None;

		// 返回上一个活动的订阅者
		return prevSub;
	}

	// 结束追踪依赖
	export function endTrack(sub: Subscriber, prevSub: Subscriber | undefined): void {
		// 如果上一个活动的订阅者不为undefined
		if (prevSub !== undefined) {
			// 设置当前活动的订阅者为上一个活动的订阅者
			system.activeSub = prevSub;
			// 设置当前活动的追踪ID为上一个活动的订阅者的追踪ID
			system.activeTrackId = prevSub.trackId;
		} else {
			// 设置当前活动的订阅者为undefined
			system.activeSub = undefined;
			// 设置当前活动的追踪ID为0
			system.activeTrackId = 0;
		}

		// 获取订阅者依赖链表尾
		const depsTail = sub.depsTail;
		// 如果订阅者依赖链表尾不为undefined
		if (depsTail !== undefined) {
			// 如果订阅者依赖链表尾的下一个依赖不为undefined
			if (depsTail.nextDep !== undefined) {
				// 清除依赖链表
				clearTrack(depsTail.nextDep);
				// 设置订阅者依赖链表尾的下一个依赖为undefined
				depsTail.nextDep = undefined;
			}
		} else if (sub.deps !== undefined) {
			// 清除依赖链表
			clearTrack(sub.deps);
			// 设置订阅者依赖链表为undefined
			sub.deps = undefined;
		}
		// 设置订阅者的追踪ID为负的追踪ID
		sub.trackId = -sub.trackId;
	}

	// 清除追踪
	export function clearTrack(link: Link): void {
		do {
			// 获取链接的依赖
			const dep = link.dep;
			// 获取链接的下一个依赖
			const nextDep = link.nextDep;
			// 释放链接
			Link.release(link);
			// 如果依赖的订阅者链表为undefined，并且依赖有deps属性
			if (dep.subs === undefined && 'deps' in dep) {
				// 如果依赖有notify方法
				if ('notify' in dep) {
					// 设置依赖的脏标记为None
					dep.dirtyLevel = DirtyLevels.None;
				} else {
					// 设置依赖的脏标记为脏
					dep.dirtyLevel = DirtyLevels.Dirty;
				}
				// 如果依赖的依赖链表不为undefined
				if (dep.deps !== undefined) {
					// 设置链接为依赖的依赖链表
					link = dep.deps;
					// 设置依赖的依赖链表尾的下一个依赖为下一个依赖
					dep.depsTail!.nextDep = nextDep;
					// 设置依赖的依赖链表为undefined
					dep.deps = undefined;
					// 设置依赖的依赖链表尾为undefined
					dep.depsTail = undefined;
					// 继续循环
					continue;
				}
			}
			// 设置链接为下一个依赖
			link = nextDep!;
		} while (link !== undefined);
	}
}
