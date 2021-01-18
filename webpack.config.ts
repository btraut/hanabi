/* global __dirname, process */

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import dotenv from 'dotenv';
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
	mode: process.env.NODE_ENV as 'development' | 'production',
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
		modules: [path.resolve(ROOT_PATH, 'node_modules'), ROOT_PATH],
	},
};

// Load environment variables from .env file.
dotenv.config({ path: path.resolve(ROOT_PATH, '.env') });

const isDevelopment = process.env.NODE_ENV === 'development';

const clientConfig: Configuration = {
	...baseConfig,

	entry: {
		client: path.resolve(APP_PATH, 'src/client.tsx'),
	},
	output: {
		path: CLIENT_BUILD_PATH,
		filename: isDevelopment ? 'js/[name]-[fullhash].js' : 'js/[name].js',
		publicPath: '/',
	},
	module: {
		rules: [
			{
				enforce: 'pre',
				test: /\.ts(x?)$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
			},
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
		new MiniCssExtractPlugin({
			filename: isDevelopment ? 'css/main-[fullhash].css' : 'css/main.css',
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
		new CleanWebpackPlugin(),
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
				enforce: 'pre',
				test: /\.ts(x?)$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
			},
			{
				test: /\.ts(x?)$/,
				exclude: /node_modules/,
				use: ['babel-loader', 'ts-loader'],
			},
		],
	},
	plugins: [
		new webpack.DefinePlugin({
			DOMAIN_BASE: JSON.stringify(process.env.DOMAIN_BASE),
			PORT: JSON.stringify(process.env.PORT),
			ENV_PATH: JSON.stringify(path.resolve(ROOT_PATH, '.env')),
			PUBLIC_ASSETS_PATH: JSON.stringify(CLIENT_BUILD_PATH),
			SAVED_GAMES_PATH: JSON.stringify(path.resolve(SERVER_BUILD_PATH, 'saved-games')),
			VIEWS_PATH: JSON.stringify(path.resolve(SERVER_BUILD_PATH, 'views')),
		}),
		new CleanWebpackPlugin(),
	],
	node: {
		__dirname: false,
		__filename: false,
	},
};

export default [clientConfig, serverConfig];
