const mp3WorkerUrl = new URL("./mp3-worker.js", document.currentScript.src).href;

async function convertToMp3(recordedBlob) {
  if (!window.OfflineAudioContext || !window.Worker) {
    throw new Error("This browser cannot convert audio to MP3.");
  }

  // Decode to 44.1 kHz PCM so the encoder receives a consistent sample rate.
  const decodeContext = new OfflineAudioContext(1, 1, 44100);
  let decoded;
  try {
    decoded = await decodeContext.decodeAudioData(await recordedBlob.arrayBuffer());
  } catch {
    throw new Error("The browser could not decode this recording. Try recording for at least a second.");
  }
  const samples = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const channelData = decoded.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      samples[i] += channelData[i] / decoded.numberOfChannels;
    }
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(mp3WorkerUrl);
    worker.addEventListener("message", (event) => {
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.blob);
    }, { once: true });
    worker.addEventListener("error", () => {
      worker.terminate();
      reject(new Error("The MP3 encoder files could not load. Open the site through localhost or HTTPS and keep the vendor folder with the website."));
    }, { once: true });
    worker.postMessage({ samples, sampleRate: decoded.sampleRate }, [samples.buffer]);
  });
}
