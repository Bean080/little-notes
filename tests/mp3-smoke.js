function makeToneWav() {
  const sampleRate = 44100;
  const sampleCount = sampleRate;
  const bytes = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(bytes);
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  for (let i = 0; i < sampleCount; i++) {
    view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 8000), true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

document.querySelector("#run").addEventListener("click", async () => {
  const result = document.querySelector("#result");
  result.textContent = "Encoding…";
  try {
    const mp3 = await convertToMp3(makeToneWav());
    const decoder = new OfflineAudioContext(1, 1, 44100);
    const decoded = await decoder.decodeAudioData(await mp3.arrayBuffer());
    if (mp3.type !== "audio/mpeg" || mp3.size < 1000 || Math.abs(decoded.duration - 1) > 0.1) {
      throw new Error(`Unexpected output: ${mp3.type}, ${mp3.size} bytes, ${decoded.duration.toFixed(2)} seconds`);
    }
    const preview = document.querySelector("#preview");
    preview.src = URL.createObjectURL(mp3);
    preview.hidden = false;
    result.textContent = `PASS: decoded ${mp3.size} byte MP3 (${decoded.duration.toFixed(2)} seconds)`;
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
  }
});

document.querySelector("#run-recorder").addEventListener("click", async () => {
  const result = document.querySelector("#result");
  result.textContent = "Recording a generated tone…";
  let context;
  try {
    context = new AudioContext();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.2;
    oscillator.frequency.value = 440;
    oscillator.connect(gain).connect(destination);
    oscillator.start();

    const recorder = new MediaRecorder(destination.stream);
    const chunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const stopped = new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    recorder.stop();
    await stopped;
    oscillator.stop();

    const recording = new Blob(chunks, { type: recorder.mimeType });
    result.textContent = `Captured ${recording.size} bytes as ${recording.type}; converting…`;
    let mp3;
    try {
      mp3 = await convertToMp3(recording);
    } catch (error) {
      throw new Error(`Source decode or MP3 encode: ${error.message}; source ${recording.type}, ${recording.size} bytes`);
    }
    const decoder = new OfflineAudioContext(1, 1, 44100);
    let decoded;
    try {
      decoded = await decoder.decodeAudioData(await mp3.arrayBuffer());
    } catch (error) {
      throw new Error(`MP3 decode: ${error.message}; output ${mp3.size} bytes`);
    }
    if (mp3.type !== "audio/mpeg" || mp3.size < 1000 || decoded.duration < 0.3) {
      throw new Error(`Unexpected output: ${mp3.type}, ${mp3.size} bytes, ${decoded.duration.toFixed(2)} seconds`);
    }
    result.textContent = `PASS: ${recorder.mimeType} converted to MP3 (${decoded.duration.toFixed(2)} seconds)`;
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
  } finally {
    await context?.close();
  }
});
