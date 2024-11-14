import { computed, ISignal } from '../index.js';

// 计算数组
export function computedArray<I, O>(
	// 数组
	arr: ISignal<I[]>,
	// 获取计算值的函数
	getGetter: (item: ISignal<I>, index: number) => () => O
) {
	// 计算数组长度
	const length = computed(() => arr.get().length);
	// 计算数组键
	const keys = computed(
		() => {
			// 创建数组键
			const keys: string[] = [];
			// 遍历数组长度
			for (let i = 0; i < length.get(); i++) {
				// 添加数组键
				keys.push(String(i));
			}
			// 返回数组键
			return keys;
		}
	);
	// 计算数组项
	const items = computed<ISignal<O>[]>(
		(array) => {
			// 如果数组为undefined，则创建数组
			array ??= [];
			// 遍历数组长度
			while (array.length < length.get()) {
				// 获取数组索引
				const index = array.length;
				// 计算数组项
				const item = computed(() => arr.get()[index]);
				// 添加数组项
				array.push(computed(getGetter(item, index)));
			}
			// 如果数组长度大于数组长度，则截断数组
			if (array.length > length.get()) {
				// 截断数组
				array.length = length.get();
			}
			// 返回数组
			return array;
		}
	);

	// 返回代理对象
	return new Proxy({}, {
		// 获取代理对象的值
		get(_, p, receiver) {
			// 如果获取的是length属性，则返回数组长度
			if (p === 'length') {
				// 返回数组长度
				return length.get();
			}
			// 如果获取的是数组项，则返回数组项
			if (typeof p === 'string' && !isNaN(Number(p))) {
				// 返回数组项
				return items.get()[Number(p)]?.get();
			}
			// 返回数组项
			return Reflect.get(items.get(), p, receiver);
		},
		// 检查对象是否具有指定属性
		has(_, p) {
			// 返回对象是否具有指定属性
			return Reflect.has(items.get(), p);
		},
		// 返回对象的自有属性键
		ownKeys() {
			// 返回数组键
			return keys.get();
		},
	}) as unknown as readonly Readonly<O>[];
}
