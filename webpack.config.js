import CopyWebpackPlugin from "copy-webpack-plugin";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  mode: "production",
  entry: {
    background: "./background.js",
    mic: "./mic.js",
  },
  output: {
    path: resolve(__dirname, "extension"),
    filename: "[name]/index.js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  modules: false,
                  useBuiltIns: "usage",
                  corejs: 3,
                  targets: { chrome: "57" },
                },
              ],
            ],
          },
        },
      },
    ],
  },
  devtool: "cheap-module-source-map",
  optimization: {
    minimize: false,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "node_modules/bootstrap/dist/css/bootstrap.min.css",
        },
      ],
    }),
  ],
};
