import Page from '~/pages/Page';
import useSetTitle from '~/utils/client/useSetTitle';

const title = 'Ten Four Games | 404';

const Error404Page: Page = () => {
	useSetTitle(title);

	return (
		<div>
			<h1 className="Error404Page-SectionHeader">404 &ndash; Page Not Found</h1>
			<p className="Error404Page-Message">
				Looks like our pipes are broken. The page you requested doesn’t exist. Sorry about that!
			</p>
		</div>
	);
};

Error404Page.title = title;

export default Error404Page;
