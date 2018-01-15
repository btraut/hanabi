import { PureComponent } from 'react';
import * as ReactRouter from 'react-router';
import { withRouter } from 'react-router-dom';

class ScrollToTop<P extends ReactRouter.RouteComponentProps<any>> extends PureComponent<P> {
    public componentDidUpdate(prevProps: P) {
        if (this.props.location !== prevProps.location) {
            window.scrollTo(0, 0);
        }
    }

    public render() {
        return this.props.children;
    }
}

export default withRouter(ScrollToTop);
