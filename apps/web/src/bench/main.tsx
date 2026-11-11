import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-400-italic.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '../styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import BenchReviewApp from './BenchReviewApp';

createRoot(document.getElementById('app')!).render(<BenchReviewApp />);
