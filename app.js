const MAX_DURATION_SECONDS = 300;

const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const titleInput = document.querySelector("#memo-title");
const timer = document.querySelector("#timer");
const caption = document.querySelector("#recording-caption");
const display = document.querySelector("#recording-display");
const status = document.querySelector("#status");
const memoList = document.querySelector("#memo-list");
const memoCount = document.querySelector("#memo-count");

const memos = [];
let recorder = null;
let stream = null;
let chunks = [];
let startedAt = 0;
let timerInterval = null;
let recordingFailed = false;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("status-error", isError);
}

function getSupportedMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function releaseMicrophone() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

function resetRecorderControls() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  display.classList.remove("is-recording");
  recordButton.disabled = false;
  stopButton.disabled = true;
  caption.textContent = "Ready to record";
  releaseMicrophone();
}

function renderMemos() {
  memoCount.textContent = String(memos.length);
  memoList.replaceChildren();

  if (memos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = '<strong>No recordings yet</strong><p>Use the recorder above to create one.</p>';
    memoList.append(empty);
    return;
  }

  for (const memo of memos) {
    const item = document.createElement("article");
    item.className = "memo-item";

    const info = document.createElement("div");
    info.className = "memo-info";
    const heading = document.createElement("h3");
    heading.textContent = memo.title;
    const details = document.createElement("p");
    details.textContent = `${memo.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · ${formatTime(memo.duration)}`;
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = memo.url;
    audio.setAttribute("aria-label", `Play ${memo.title}`);
    info.append(heading, details, audio);

    const actions = document.createElement("div");
    actions.className = "memo-actions";
    const download = document.createElement("button");
    download.type = "button";
    download.className = "text-button";
    download.textContent = `Download ${memo.extension.toUpperCase()}`;
    download.addEventListener("click", () => {
      const link = document.createElement("a");
      link.href = memo.url;
      link.download = `${memo.title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "voice-memo"}.${memo.extension}`;
      document.body.append(link);
      link.click();
      link.remove();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button text-button-danger";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${memo.title}`);
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(memo.url);
      memos.splice(memos.indexOf(memo), 1);
      renderMemos();
      setStatus("Memo deleted from this tab.");
    });
    actions.append(download, remove);
    item.append(info, actions);
    memoList.append(item);
  }
}

async function startRecording() {
  recordButton.disabled = true;
  setStatus("Requesting microphone access…");

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recordingFailed = false;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener("error", () => {
      recordingFailed = true;
      setStatus("Recording failed. Please try again.", true);
      if (recorder?.state === "recording") recorder.stop();
    });
    recorder.addEventListener("stop", finishRecording, { once: true });
    recorder.start();
    startedAt = Date.now();
    timer.textContent = "00:00";
    display.classList.add("is-recording");
    caption.textContent = "Recording in progress";
    stopButton.disabled = false;
    setStatus("Recording… up to 5 minutes.");
    timerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      timer.textContent = formatTime(Math.min(elapsed, MAX_DURATION_SECONDS));
      if (elapsed >= MAX_DURATION_SECONDS) stopRecording();
    }, 250);
  } catch (error) {
    resetRecorderControls();
    setStatus(error?.name === "NotAllowedError"
      ? "Microphone access was denied. Allow access in your browser settings and try again."
      : "We could not start the microphone. Check your device and try again.", true);
  }
}

function stopRecording() {
  if (recorder?.state !== "recording") return;
  stopButton.disabled = true;
  recorder.stop();
}

async function finishRecording() {
  const duration = Math.min(Math.max(1, Math.round((Date.now() - startedAt) / 1000)), MAX_DURATION_SECONDS);
  const mimeType = recorder?.mimeType || chunks[0]?.type || "audio/webm";
  const recordedChunks = chunks;
  chunks = [];
  resetRecorderControls();

  if (recordingFailed || recordedChunks.length === 0) {
    if (!recordingFailed) setStatus("No audio was captured. Please try again.", true);
    return;
  }

  const recordedBlob = new Blob(recordedChunks, { type: mimeType });
  const title = titleInput.value.trim() || "Untitled memo";
  timer.textContent = "00:00";
  recordButton.disabled = true;
  caption.textContent = "Preparing your MP3";
  setStatus("Converting your recording to MP3…");

  try {
    const mp3Blob = await convertToMp3(recordedBlob);
    if (mp3Blob.size === 0) throw new Error("The MP3 file was empty.");
    memos.unshift({ title, duration, extension: "mp3", createdAt: new Date(), url: URL.createObjectURL(mp3Blob) });
    titleInput.value = "";
    renderMemos();
    setStatus("MP3 ready. Download it before leaving this tab if you want to keep it.");
  } catch (error) {
    const extension = mimeType.includes("mp4") ? "m4a" : "webm";
    memos.unshift({ title, duration, extension, createdAt: new Date(), url: URL.createObjectURL(recordedBlob) });
    renderMemos();
    setStatus(`MP3 conversion failed: ${error.message} Your original recording is available to download.`, true);
    console.error("MP3 conversion failed:", error);
  } finally {
    caption.textContent = "Ready to record";
    recordButton.disabled = false;
  }
}

if (window.location.protocol === "file:") {
  recordButton.disabled = true;
  setStatus("Open this site through localhost or HTTPS to record MP3s. Opening index.html directly cannot load the MP3 encoder.", true);
} else if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
  recordButton.disabled = true;
  setStatus("Recording is unavailable in this browser. Try a current browser over HTTPS or localhost.", true);
} else {
  recordButton.addEventListener("click", startRecording);
  stopButton.addEventListener("click", stopRecording);
}

window.addEventListener("pagehide", () => {
  releaseMicrophone();
  memos.forEach((memo) => URL.revokeObjectURL(memo.url));
});

renderMemos();
