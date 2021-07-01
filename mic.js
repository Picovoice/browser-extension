import { PorcupineWorkerFactory } from "@picovoice/porcupine-web-en-worker";
import { WebVoiceProcessor } from "@picovoice/web-voice-processor";
import { browser } from "webextension-polyfill-ts";

import { GOOGLE_SEARCH_LANGUAGES } from "./google_search_languages.js";

for (const [language, value] of Object.entries(GOOGLE_SEARCH_LANGUAGES)) {
  const optGroup = document.createElement("optgroup");
  optGroup.label = language; // e.g. "English"

  for (const [country, code] of value) {
    const option = document.createElement("option");
    option.value = code;
    option.label = `${country} (${code})`; // e.g. "USA (en-US)"
    optGroup.appendChild(option);
  }

  document.getElementById("select-search-language").appendChild(optGroup);
}

const DEFAULT_SENSITIVITY = 0.5;
const DEFAULT_WAKE_WORD = "Okay Google";
const DEFAULT_GOOGLE_VOICE_SEARCH_LANGUAGE = "en-US";
const STRINGS_READY = "Porcupine is ready and listening for the wake word.";
const STRINGS_INITIALIZING = "Initializing Porcupine...";

let ppnStatus = "unknown";

async function init() {
  await initializeUiValues();
  await startPorcupine();
}

/**
 * Set the values on the UI from data from browser storage,
 * instead of from HTML.
 */
async function initializeUiValues() {
  const { wakeWord, sensitivity, searchLanguage } =
    await getOptionsFromStorage();

  document.getElementById("select-wake-word").value = wakeWord;
  document.getElementById("input-sensitivity").value = sensitivity;
  document.getElementById("select-search-language").value = searchLanguage;
}

/**
 * Options are peristed to browser storage. If they've never been set,
 * give them defaults and set them.
 */
async function getOptionsFromStorage() {
  const data1 = await browser.storage.local.get("wakeWord");
  let wakeWord;

  if (data1.wakeWord === undefined) {
    await browser.storage.local.set({ wakeWord: DEFAULT_WAKE_WORD });
    wakeWord = DEFAULT_WAKE_WORD;
  } else {
    wakeWord = data1.wakeWord;
  }

  const data2 = await browser.storage.local.get("sensitivity");
  let sensitivity;
  if (data2.sensitivity === undefined) {
    sensitivity = DEFAULT_SENSITIVITY;
    await browser.storage.local.set({ sensitivity: DEFAULT_SENSITIVITY });
  } else {
    sensitivity = data2.sensitivity;
  }

  const data3 = await browser.storage.local.get("searchLanguage");
  let searchLanguage;
  if (data3.searchLanguage === undefined) {
    searchLanguage = DEFAULT_GOOGLE_VOICE_SEARCH_LANGUAGE;
    await browser.storage.local.set({
      searchLanguage: DEFAULT_GOOGLE_VOICE_SEARCH_LANGUAGE,
    });
  } else {
    searchLanguage = data3.searchLanguage;
  }

  return { wakeWord, sensitivity, searchLanguage };
}

// Options
document.getElementById("select-wake-word").onchange = async (event) => {
  const newWakeWord = event.target.value;
  await browser.storage.local.set({ wakeWord: newWakeWord });
  startPorcupine();
};
document.getElementById("input-sensitivity").onchange = async (event) => {
  const newSensitivity = event.target.value;
  await browser.storage.local.set({ sensitivity: newSensitivity });
  startPorcupine();
};
document.getElementById("select-search-language").onchange = async (event) => {
  const newSearchLanguage = event.target.value;
  await browser.storage.local.set({ searchLanguage: newSearchLanguage });
  startPorcupine();
};

function setPpnStatus(status, message) {
  let alertElement = document.getElementById("alert-status");

  switch (status) {
    case "error":
      alertElement.innerHTML = "Error: " + message;
      alertElement.className = "alert alert-danger";

      document.getElementById("input-sensitivity").disabled = true;
      document.getElementById("select-wake-word").disabled = true;
      break;
    case "init":
      alertElement.className = "alert alert-info";
      alertElement.innerHTML = STRINGS_INITIALIZING;

      document.getElementById("input-sensitivity").disabled = true;
      document.getElementById("select-wake-word").disabled = true;
      break;
    case "ready":
      alertElement.className = "alert alert-success";
      alertElement.innerHTML = STRINGS_READY;

      document.getElementById("input-sensitivity").disabled = false;
      document.getElementById("select-wake-word").disabled = false;
      document.getElementById("select-search-language").disabled = false;
      break;
    case "keyword":
      alertElement.className = "alert alert-warning";
      alertElement.innerHTML = message ?? "[Say your search query]";
      break;
  }

  ppnStatus = status;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPorcupine() {
  const { wakeWord, sensitivity, searchLanguage } =
    await getOptionsFromStorage();
  const sensitivityNormalized = sensitivity / 100.0;

  setPpnStatus("init");

  let ppnWorker;
  try {
    ppnWorker = await PorcupineWorkerFactory.create({
      builtin: wakeWord,
      sensitivity: sensitivityNormalized,
    });
  } catch (error) {
    setPpnStatus("error", error);
    console.error(error);
    return;
  }

  // Add a very small delay; initialization is async, but it's typically quite fast,
  // making the GUI confusing and appear glitchy.
  await sleep(500);

  console.log("Porcupine is ready!");
  setPpnStatus("ready");
  browser.runtime.sendMessage({
    command: "ready",
  });

  try {
    const webVp = await WebVoiceProcessor.init({
      engines: [ppnWorker],
      start: true,
    });
  } catch (error) {
    setPpnStatus("error", error);
    browser.runtime.sendMessage({
      command: "error",
    });
    console.error(error);
    return;
  }

  ppnWorker.onmessage = (messageEvent) => {
    if (messageEvent.data.command === "ppn-keyword") {
      // If already in keyword state, ignore until transcription is finished
      if (ppnStatus === "keyword") {
        return;
      }

      setPpnStatus("keyword");

      browser.runtime.sendMessage({ ...messageEvent.data });

      const speech = new webkitSpeechRecognition();
      let transcript;
      speech.lang = searchLanguage;
      speech.interimResults = true;
      speech.continuous = false;
      speech.onend = (event) => {
        setPpnStatus("ready");

        browser.runtime.sendMessage({
          command: "wsr-onend",
          transcript: transcript,
        });
      };
      speech.onresult = (event) => {
        transcript = "";
        for (const line of event.results) {
          transcript += line[0].transcript.trim() + " ";
        }

        setPpnStatus("keyword", transcript);

        browser.runtime.sendMessage({
          command: "wsr-onresult",
          transcript: transcript.trim(),
        });
      };
      speech.start();
    }
  };
}

init();
