import Page from './Page';

const Error404Page: Page = () => {
	return (
		<div>
			<h1 className="Error404Page-SectionHeader">404 &ndash; Page Not Found</h1>
			<p className="Error404Page-Message">
				Looks like our pipes are broken. The page you requested doesn’t exist. Sorry about that!
			</p>
		</div>
	);
};

Error404Page.preload = async function () {
	console.log('404 preloaded');
};

Error404Page.title = 'Escape | 404';

export default Error404Page;
