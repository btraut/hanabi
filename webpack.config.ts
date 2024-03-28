import dotenv from 'dotenv';
import ESLintPlugin from 'eslint-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import webpack, { Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';

// Define config consts.
const ROOT_PATH = __dirname;
const APP_PATH = path.resolve(ROOT_PATH, 'app');
const BUILD_PATH = path.resolve(ROOT_PATH, '.build');
const CLIENT_BUILD_PATH = path.resolve(BUILD_PATH, 'client');
const SERVER_BUILD_PATH = path.resolve(BUILD_PATH, 'server');

const baseConfig: Partial<Configuration> = {
	context: ROOT_PATH,
	devtool: 'source-map',
	mode: (process.env.NODE_ENV as 'development' | 'production') ?? 'production',
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
		modules: [path.resolve(ROOT_PATH, 'node_modules'), ROOT_PATH],
	},
};

// Load environment variables from .env file.
dotenv.config({ path: path.resolve(ROOT_PATH, '.env') });

const clientConfig: Configuration = {
	...baseConfig,

	entry: {
		client: path.resolve(APP_PATH, 'src/client.tsx'),
	},
	output: {
		path: CLIENT_BUILD_PATH,
		filename: 'js/[name]-[chunkhash].js',
		publicPath: '/',
	},
	module: {
		rules: [
			{
				test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
				use: [
					{
						loader: 'file-loader',
						options: {
							name: '[path][name].[ext]',
							context: APP_PATH,
						},
					},
					'image-webpack-loader',
				],
			},
			{
				test: /\.(woff|woff2|ttf|eot|wav)$/,
				use: [
					{
						loader: 'file-loader',
						options: {
							name: '[path][name].[ext]',
							context: APP_PATH,
						},
					},
				],
			},
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
			},
			{
				test: /\.ts(x?)$/,
				exclude: /node_modules/,
				use: ['babel-loader', 'ts-loader'],
			},
		],
	},
	plugins: [
		new ESLintPlugin({
			extensions: ['ts', 'tsx'],
			exclude: '**/node_modules/**',
		}),
		new MiniCssExtractPlugin({
			filename: 'css/main-[chunkhash].css',
		}),
		new HtmlWebpackPlugin({
			template: path.resolve(APP_PATH, 'index.html'),
			filename: '../server/views/index.html',
			inject: true,
			minify: {
				removeComments: true,
			},
		}),
		new webpack.DefinePlugin({
			DOMAIN_BASE: JSON.stringify(process.env.DOMAIN_BASE),
			NODE_ENV: JSON.stringify(process.env.NODE_ENV),
		}),
	].filter(Boolean),
};

const serverConfig: Configuration = {
	...baseConfig,

	entry: {
		server: path.resolve(APP_PATH, 'src/server.tsx'),
	},
	output: {
		path: SERVER_BUILD_PATH,
		filename: '[name].js',
		libraryTarget: 'commonjs',
	},
	target: 'node',
	externals: [nodeExternals()],
	module: {
		rules: [
			{
				test: /\.ts(x?)$/,
				exclude: /node_modules/,
				use: ['babel-loader', 'ts-loader'],
			},
		],
	},
	plugins: [
		new ESLintPlugin({
			extensions: ['ts', 'tsx'],
			exclude: '**/node_modules/**',
		}),
		new webpack.DefinePlugin({
			DOMAIN_BASE: JSON.stringify(process.env.DOMAIN_BASE),
			NODE_ENV: JSON.stringify(process.env.NODE_ENV),

			// Root, relative to the build (server.js):
			RELATIVE_ROOT_PATH: JSON.stringify('../../'),

			// Paths, all relative to root:
			ENV_PATH: JSON.stringify('.env'),
			PUBLIC_ASSETS_PATH: JSON.stringify('.build/client'),
			SAVED_GAMES_PATH: JSON.stringify('.build/server/saved-games'),
			VIEWS_PATH: JSON.stringify('.build/server/views'),
		}),
	],
	node: {
		__dirname: false,
		__filename: false,
	},
};

export default [clientConfig, serverConfig];
