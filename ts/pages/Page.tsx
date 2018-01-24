import { ComponentClass, SFC } from 'react';
import { RouteProps } from 'react-router';

export type PageClass = (ComponentClass<RouteProps> | SFC<RouteProps>) & {
	preload?: () => Promise<void>;
	title?: string | (() => Promise<string>);
};
