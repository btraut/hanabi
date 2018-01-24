import { cloneElement, Children, PureComponent } from 'react';
import * as ReactRouter from 'react-router';
import { withRouter } from 'react-router-dom';

class ScrollToTop<P extends ReactRouter.RouteComponentProps<any>> extends PureComponent<P> {
	public componentDidUpdate(prevProps: P) {
		if (this.props.location !== prevProps.location) {
			window.scrollTo(0, 0);
		}
	}

	public render() {
		// Pass props through this component to children.
		return Children.map(this.props.children, child => {
			if (typeof child === 'string' || typeof child === 'number') {
				return child;
			}
			
			return cloneElement(child, this.props);
		});
	}
}

export default withRouter(ScrollToTop);
