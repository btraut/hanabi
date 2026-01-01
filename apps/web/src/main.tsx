import './styles/tailwind.css';
import App from './components/App';
import routes from './routes';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Start the app.
createRoot(document.getElementById('app')!).render(
	<BrowserRouter>
		<App routes={routes} />
	</BrowserRouter>,
);
