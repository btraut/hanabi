'use strict';

import AssetsPlugin from 'assets-webpack-plugin';
import autoprefixer from 'autoprefixer';
import CleanWebpackPlugin from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import nodeExternals from 'webpack-node-externals';
import path from 'path';
import StyleLintPlugin from 'stylelint-webpack-plugin';
import UglifyJSPlugin from 'uglifyjs-webpack-plugin';
import webpack from 'webpack';

// Load environment variables from .env file.
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Define config consts.
const SOURCE_PATH = __dirname;
const BUILD_PATH = __dirname + '/.build';
const CLIENT_BUILD_PATH = BUILD_PATH + '/client';
const SERVER_BUILD_PATH = BUILD_PATH + '/server';
const STANDALONE_BUILD_PATH = BUILD_PATH + '/client/js/';

const baseModuleRules = [{
    test: /\.tsx?$/,
    enforce: 'pre',
    loader: 'tslint-loader'
}, {
    test: /\.(png|jpg|jpeg|gif)$/,
    loader: 'file-loader?name=[path][name].[ext]'
}, {
    test: /\.svg$/,
    use: [
        'svg-inline-loader',
        {
            loader: 'svgo-loader',
            options: {
                plugins: [
                    { removeTitle: true }
                ]
            }
        }
    ]
}, {
    test: /\.(woff|woff2|ttf|eot)$/,
    loader: 'file-loader?name=[path][name].[ext]'
}, {
    test: /\.tsx?$/,
    use: [
        {
            loader: 'babel-loader',
            options: {
                presets: [__dirname + '/node_modules/babel-preset-es2015']
            }
        },
        'ts-loader'
    ]
}, {
    test: /\.handlebars$/,
    loader: 'raw-loader'
}];

const baseConfig = {
    context: SOURCE_PATH + '/ts',
    devtool: 'source-map',
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: ['.ts', '.tsx', '.js'],
        modules: [__dirname + '/node_modules']
    }
};

const clientPlugins = [];

let clientScriptFilename = 'js/[name]-[hash].js';
let clientStylesFilename = './css/main-[hash].css';

if (process.env.NODE_ENV === 'development') {
    clientPlugins.push(new LiveReloadPlugin());
    
    clientScriptFilename = 'js/[name].js';
    clientStylesFilename = './css/main.css';
} else {
    clientPlugins.push(new UglifyJSPlugin());  
}

const clientConfig = {
    ...baseConfig,
    
    entry: {
        client: './client.tsx'
    },
    output: {
        path: CLIENT_BUILD_PATH,
        filename: clientScriptFilename,
        publicPath: '/'
    },
    externals: {
        'react': 'React',
        'react-dom': 'ReactDOM'
    },
    module: {
        rules: [
            ...baseModuleRules,
            {
                test: /\.(le|c)ss$/,
                use: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: [
                        'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                plugins: () => {
                                    return [autoprefixer];
                                }
                            }
                        },
                        'less-loader'
                    ]
                })
            }
        ]
    },
    plugins: [
        ...clientPlugins,
        
        new AssetsPlugin({
            prettyPrint: true
        }),
        new StyleLintPlugin({
            context: SOURCE_PATH + '/public/less/',
            files: '**/*.less',
            failOnError: false,
            syntax: 'less'
        }),
        // new CleanWebpackPlugin([CLIENT_BUILD_PATH]),
        new ExtractTextPlugin({
            filename: clientStylesFilename,
            allChunks: true
        }),
        new CopyWebpackPlugin([{
            context: SOURCE_PATH + '/node_modules/react/dist/',
            from: '*.js',
            to: CLIENT_BUILD_PATH + '/js/'
        }, {
            context: SOURCE_PATH + '/node_modules/react-dom/dist/',
            from: '*.js',
            to: CLIENT_BUILD_PATH + '/js/'
        }, {
            context: SOURCE_PATH + '/public/images/',
            from: '**/*',
            to: CLIENT_BUILD_PATH + '/images/'
        }, {
            context: SOURCE_PATH + '/public/',
            from: '*.*',
            to: CLIENT_BUILD_PATH + '/'
        }]),
        new webpack.DefinePlugin({
            DOMAIN_BASE: JSON.stringify(process.env.DOMAIN_BASE),
            NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            GOOGLE_MAPS_API_KEY: JSON.stringify(process.env.GOOGLE_MAPS_API_KEY)
        })
    ]
};

const serverConfig = {
    ...baseConfig,
    
    entry: {
        server: './server.ts'
    },
    output: {
        path: SERVER_BUILD_PATH,
        filename: '[name].js',
        libraryTarget: 'commonjs'
    },
    target: 'node',
    externals: [nodeExternals()],
    module: {
        rules: [
            ...baseModuleRules
        ]
    },
    plugins: [
        new CleanWebpackPlugin([SERVER_BUILD_PATH]),
        new CopyWebpackPlugin([{
            from: SOURCE_PATH + '/views',
            to: SERVER_BUILD_PATH + '/views'
        }]),
        new webpack.DefinePlugin({
            DOMAIN_BASE: JSON.stringify(process.env.DOMAIN_BASE),
            ENV_PATH: JSON.stringify('../../.env'),
            PUBLIC_ASSETS_PATH: JSON.stringify('../client'),
            SERVER_VIEWS_PATH: JSON.stringify('views'),
            GOOGLE_MAPS_API_KEY: JSON.stringify(process.env.GOOGLE_MAPS_API_KEY)
        })
    ],
    node: {
        __dirname: false,
        __filename: false
    }
}

export default [
    clientConfig,
    serverConfig
];
