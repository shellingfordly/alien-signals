import { computed, ISignal } from '../index.js';

// 计算集合
export function computedSet<T>(source: ISignal<Set<T>>): ISignal<Set<T>> {
	// 返回计算值
	return computed<Set<T>>(
		(oldValue) => {
			// 获取新值
			const newValue = source.get();
			// 如果旧值的大小和新值的大小相同，并且旧值的每个元素都在新值中，则返回旧值
			if (oldValue?.size === newValue.size && [...oldValue].every(c => newValue.has(c))) {
				// 返回旧值
				return oldValue;
			}
			// 返回新值
			return newValue;
		}
	);
}
