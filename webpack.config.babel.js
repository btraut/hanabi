/* global __dirname, process */

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import CopyWebpackPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import webpack from 'webpack';
import nodeExternals from 'webpack-node-externals';

// Load environment variables from .env file.
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Define config consts.
const SOURCE_PATH = __dirname + '/app';
const BUILD_PATH = __dirname + '/.build';
const CLIENT_BUILD_PATH = BUILD_PATH + '/client';
const SERVER_BUILD_PATH = BUILD_PATH + '/server';

const baseConfig = {
	context: SOURCE_PATH,
	devtool: 'source-map',
	mode: 'development',
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
		modules: [__dirname + '/node_modules', __dirname],
	},
};

const baseModuleRules = [
	{
		enforce: 'pre',
		test: /\.ts(x?)$/,
		exclude: /node_modules/,
		loader: 'eslint-loader',
	},
	{
		test: /\.(png|jpg|jpeg|gif|svg)$/,
		use: [
			{
				loader: 'file-loader',
				options: {
					name: '[path][name].[ext]',
					publicPath: '../',
				},
			},
			'image-webpack-loader',
		],
	},
	{
		test: /\.ts(x?)$/,
		exclude: /node_modules/,
		use: ['babel-loader', 'ts-loader'],
	},
	{
		test: /\.(woff|woff2|ttf|eot)$/,
		use: [
			{
				loader: 'file-loader',
				options: {
					name: '[path][name].[ext]',
					publicPath: '../',
				},
			},
		],
	},
];

const clientConfig = {
	...baseConfig,

	entry: {
		client: './src/client.tsx',
	},
	output: {
		path: CLIENT_BUILD_PATH,
		filename: process.env.NODE_ENV === 'development' ? 'js/[name]-[fullhash].js' : 'js/[name].js',
		publicPath: '/',
	},
	module: {
		rules: [
			...baseModuleRules,
			{
				test: /\.(le|c)ss$/,
				use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
			},
		],
	},
	plugins: [
		new MiniCssExtractPlugin({
			filename:
				process.env.NODE_ENV === 'development' ? './css/main-[fullhash].css' : './css/main.css',
		}),
		new HtmlWebpackPlugin({
			template: SOURCE_PATH + '/index.html',
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
		new CopyWebpackPlugin({
			patterns: [
				{
					from: `${SOURCE_PATH}/images/**/*`,
					to: CLIENT_BUILD_PATH,
				},
			],
		}),
	],
};

const serverConfig = {
	...baseConfig,

	entry: {
		server: './src/server.tsx',
	},
	output: {
		path: SERVER_BUILD_PATH,
		filename: '[name].js',
		libraryTarget: 'commonjs',
	},
	target: 'node',
	externals: [nodeExternals()],
	module: {
		rules: [...baseModuleRules],
	},
	plugins: [
		new webpack.DefinePlugin({
			DOMAIN_BASE: JSON.stringify(process.env.DOMAIN_BASE),
			PORT: JSON.stringify(process.env.PORT),
			ENV_PATH: JSON.stringify('../../.env'),
			PUBLIC_ASSETS_PATH: JSON.stringify('../client'),
			SAVED_GAMES_PATH: JSON.stringify(BUILD_PATH + '/saved-games'),
			VIEWS_PATH: JSON.stringify('./views'),
		}),
	],
	node: {
		__dirname: false,
		__filename: false,
	},
};

export default [clientConfig, serverConfig];
