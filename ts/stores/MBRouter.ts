import Router from './Router';

import ErrorController from '../controllers/ErrorController';
import HomeController from '../controllers/HomeController';

const router = new Router();

// Public Routes
router.addRoute('/', HomeController.getHome);

// 404 Route
router.addRoute('*any', ErrorController.getError404);

export default router;
