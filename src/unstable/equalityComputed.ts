import { Computed, ISignal } from '../index.js';

// 创建计算值
export function equalityComputed<T>(getter: () => T): ISignal<T> {
	return new EqualityComputed(getter);
}

// 计算值类
export class EqualityComputed<T = any> extends Computed<T> {
	constructor(
		getter: () => T,
	) {
		super(oldValue => {
			// 获取新值
			const newValue = getter();
			// 如果旧值和新值相等，则返回旧值
			if (this.equals(oldValue, newValue)) {
				return oldValue!;
			}
			return newValue;
		});
	}

	equals(a: any, b: any): boolean {
		// 如果a和b相等，则返回true
		if (a === b) {
			return true;
		}
		
		// 如果a或b为null，或者a和b的类型不同，则返回false
		if (a === null || b === null || typeof a !== typeof b) {
			return false;
		}

		// 如果a和b都是对象
		if (typeof a === 'object') {
			// 如果a和b都是数组
			if (Array.isArray(a) && Array.isArray(b)) {
				// 如果a和b的长度不同，则返回false
				if (a.length !== b.length) {
					return false;
				}
				// 遍历a和b
				for (let i = 0; i < a.length; i++) {
					// 如果a和b的对应项不相等，则返回false
					if (!this.equals(a[i], b[i])) {
						return false;
					}
				}
				// 返回true
				return true;
			}
			
			// 如果a和b都不是数组
			if (!Array.isArray(a) && !Array.isArray(b)) {
				for (const key in a) {
					// 如果a具有指定属性
					if (a.hasOwnProperty(key)) {
						// 如果b不具有指定属性，或者a和b的对应项不相等，则返回false
						if (!b.hasOwnProperty(key) || !this.equals(a[key], b[key])) {
							return false;
						}
					}
				}
				// 遍历b
				for (const key in b) {
					// 如果b具有指定属性，并且a不具有指定属性，则返回false
					if (b.hasOwnProperty(key) && !a.hasOwnProperty(key)) {
						return false;
					}
				}
				return true;

			}

			// 一个为数组，另一个不为数组
			return false;
		}

		return false;
	}
}
