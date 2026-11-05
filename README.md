# Little Notes

A static voice memo website starter for GitHub Pages. It uses the browser's microphone and `MediaRecorder` to capture audio, then converts each recording to an MP3 for playback and download.

## Run locally

Serve this folder on localhost with any static file server, then open the local URL in a current browser. For example, with Python installed:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. Microphone access requires a secure context such as localhost or HTTPS.
Binding to `127.0.0.1` keeps the development server accessible only from this computer.

Do not open `index.html` by double-clicking it. A `file://` page cannot reliably load the MP3 Web Worker and WASM encoder. If MP3 conversion fails on a hosted site, make sure `mp3-converter.js`, `mp3-worker.js`, and the entire `vendor/wasm-media-encoders/` folder were published with the page.

## Current scope

Recordings are held in memory only while the tab is open. They are not uploaded or retained for seven days yet. Users can download an MP3 before closing the page. If MP3 conversion fails, the original recording remains available to download.

MP3 encoding runs locally in a Web Worker using the bundled [wasm-media-encoders](https://github.com/arseneyr/wasm-media-encoders) library (MIT license). No audio is sent to the encoder provider.

To check MP3 encoding without granting microphone access, open `http://localhost:8000/tests/mp3-smoke.html` while the local server is running and click **Run test**. It generates a one-second tone, encodes it, and decodes the MP3 to verify the file.

## Next build step

Connect Supabase authentication, a private Storage bucket, and a memo metadata table. Add a scheduled cleanup function that deletes expired audio files through the Storage API and then removes their metadata. Keep administrative keys out of this static website.

The relative paths in `index.html` allow these files to be published from the root of a GitHub Pages repository or a project subpath.

## Before publishing to GitHub Pages

Do not add private recordings, passwords, or service keys to this folder or repository. GitHub Pages publishes the selected site files publicly. The `.gitignore` file excludes common audio exports and `.env` files from ordinary Git commits, but it does not protect secrets placed directly in HTML or JavaScript. Enable **Enforce HTTPS** in the repository's Pages settings when the site is published.
