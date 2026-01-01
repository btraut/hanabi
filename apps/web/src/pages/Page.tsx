import { ComponentClass, FunctionComponent } from 'react';

type Page = (ComponentClass | FunctionComponent) & {
	preload?: () => Promise<void>;
	title?: string | (() => Promise<string>);
};

export default Page;
