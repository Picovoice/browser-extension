# Voice AI Browser Extension for Google Chrome

This is the source code for building the Voice AI Browser Extension for Google Chrome. The extension allows you to use Picovoice Porcupine to listen for a wake word, and then uses the SpeechRecogniton API to perform a Google Search via voice.

The extension serves as small but useful tool for performing voice searches with a wake word. The extension source code provides a fully functional proof-of-concept implementation of Picovoice's WASM-powered offline Voice AI used with the `WebExtension` API.

The extension use [`webextension-polyfill`](https://github.com/Lusito/webextension-polyfill-ts) via so that all of the `WebExtension` APIs are promise-based in Chrome, instead of callback-based.

## Compatibility

- Google Chrome (57)

## Prerequisites

- yarn (or npm)

## Install dependencies

```console
yarn
```

(or)

```console
npm install
```

## Build

```console
yarn build
```

(or)

```console
npm run build
```

### Update live with webpack

```console
yarn run webpack -w
```

## Run locally

After building, the `extension` subdirectory is the artifact provide to Chrome.

1. You will need to enable developer mode in Chrome, since the source version of the extension is not delivered from the Chrome Store.
1. In Chrome, go to `chrome://extensions`. Press "Load Unpacked" and then select the `extension` folder.
1. Press the blue button on the extension to activate it. (Chrome may hide this behind the "Puzzle Piece" icon.)
