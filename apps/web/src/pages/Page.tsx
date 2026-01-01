import { ComponentClass, FunctionComponent } from 'react';
import { RouteProps } from 'react-router';

type Page = (ComponentClass<RouteProps> | FunctionComponent<RouteProps>) & {
	preload?: () => Promise<void>;
	title?: string | (() => Promise<string>);
};

export default Page;
