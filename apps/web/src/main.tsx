import './styles/tailwind.css';
import App from './components/App';
import routes from './routes';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';

// Start the app.
render(
	<BrowserRouter>
		<App routes={routes} />
	</BrowserRouter>,
	document.getElementById('app'),
);
