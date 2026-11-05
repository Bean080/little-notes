// Keep MP3 encoding off the main thread so the page stays responsive.
importScripts("./vendor/wasm-media-encoders/WasmMediaEncoder.min.js");

self.addEventListener("message", async (event) => {
  try {
    const { samples, sampleRate } = event.data;
    const wasmUrl = new URL("./vendor/wasm-media-encoders/mp3.wasm", self.location.href).href;
    const encoder = await WasmMediaEncoder.createEncoder("audio/mpeg", wasmUrl);
    encoder.configure({ sampleRate, channels: 1, bitrate: 96 });

    const output = [];
    const blockSize = 16384;
    for (let offset = 0; offset < samples.length; offset += blockSize) {
      const bytes = encoder.encode([samples.subarray(offset, offset + blockSize)]);
      if (bytes.length > 0) output.push(bytes.slice());
    }
    const finalBytes = encoder.finalize();
    if (finalBytes.length > 0) output.push(finalBytes.slice());

    self.postMessage({ blob: new Blob(output, { type: "audio/mpeg" }) });
  } catch (error) {
    self.postMessage({ error: error?.message || "MP3 encoding failed." });
  }
});
