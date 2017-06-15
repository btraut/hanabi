import * as resub from 'resub';

import EnvironmentUtils from './EnvironmentUtils';

let AutoSubscribeStore: ClassDecorator = resub.AutoSubscribeStore;
let autoSubscribe: MethodDecorator = resub.autoSubscribe;
let autoSubscribeWithKey: (keyOrKeys: string | string[]) => MethodDecorator = resub.autoSubscribeWithKey;

if (!EnvironmentUtils.canUseDOM) {
	AutoSubscribeStore = (func: any): any => {
		return func;
	};
	
	autoSubscribe = <T>(_target: object, _propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void => {
		return descriptor.value;
	};
	
	autoSubscribeWithKey = (_keyOrKeys: string | string[]): MethodDecorator => {
		return (_target: object, _propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
			return descriptor.value;
		};
	};
}

export default { AutoSubscribeStore, autoSubscribe, autoSubscribeWithKey };
