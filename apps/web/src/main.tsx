import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-400-italic.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
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
