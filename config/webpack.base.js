var path = require('path');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');

/**
 * Genera la configuración webpack base para un reporte LeanIX.
 * @param {string} reportDir - __dirname del reporte (path absoluto)
 */
module.exports = function createWebpackConfig(reportDir) {
  return {
    entry: './src/index.js',
    mode: 'development',
    output: {
      path: path.resolve(reportDir, 'dist'),
      filename: 'report.[chunkhash].js',
    },
    resolve: {
      alias: {
        '@shared': path.resolve(reportDir, '../shared'),
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } },
        },
        { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        { test: /\.(otf|ttf|woff|woff2)$/, use: ['url-loader?limit=10000'] },
        { test: /\.(jpg|png|gif)$/, use: ['url-loader?limit=10000'] },
        { test: /\.(eot|svg)$/, use: ['file-loader'] },
      ],
    },
    plugins: [
      new CopyWebpackPlugin({ patterns: [{ from: 'src/assets', to: 'assets' }] }),
      new HtmlWebpackPlugin({ inject: true, template: 'src/index.html' }),
    ],
    devServer: {
      server: 'https',
      historyApiFallback: true,
      allowedHosts: 'all',
      setupMiddlewares: middlewares => middlewares.filter(m => m.name !== 'cross-origin-header-check'),
    },
  };
};
