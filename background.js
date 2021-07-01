import { browser } from "webextension-polyfill-ts";

const STATE_INITIAL = "init";
const STATE_MIC_ERROR = "err";
const STATE_ON = "on";
const STATE_OFF = "off";
const STATE_WAKE = "wake";

const GOOGLE_SEARCH_QUERY_URL = "http://google.com/search?q=";

const chime = document.getElementById("chime");
let micTabId = -1;
let xState = STATE_INITIAL;

const MIC_EXTENSION_URL = browser.runtime.getURL("/mic/mic.html");
let micOnInit;

async function updateIcon(condition) {
  let path = "../icons/pico-blue.svg";
  switch (condition) {
    case STATE_INITIAL:
      path = "../icons/pico-grey-48.png";
      break;
    case STATE_ON:
      path = "../icons/pico-blue.svg";
      break;
    case STATE_WAKE:
      path = "../icons/pico-teal.svg";
      break;
    case STATE_MIC_ERROR:
      path = "../icons/pico-pink.svg";
      break;
    case STATE_OFF:
      path = "../icons/pico-grey-48.png";
      break;
    default:
      break;
  }

  await browser.browserAction.setIcon({ path: path });
}

const setXState = async (newState) => {
  xState = newState;
  browser.browserAction.setBadgeText({ text: xState });

  if (newState === STATE_OFF) {
    await browser.storage.local.set({ micOn: false });
  }

  updateIcon(xState);
};

const browserAction = async (event) => {
  switch (xState) {
    case STATE_INITIAL:
      if (micOnInit) {
        await getOrCreateMicTab();
        await setXState(STATE_ON);
      } else {
        await setXState(STATE_OFF);
      }
      break;
    case STATE_ON:
      await setXState(STATE_OFF);
      await closeMicTab();
      await browser.storage.local.set({ micOn: false });
      break;
    case STATE_OFF:
      await setXState(STATE_ON);
      await getOrCreateMicTab();
      break;
    case STATE_MIC_ERROR:
      await closeMicTab();
      await getOrCreateMicTab();
      break;
  }
};

/** Respond to user clicking the extension icon (i.e. toggling on/off) */
browser.browserAction.onClicked.addListener(browserAction);

/** Listen for tab closing (for Mic tab) */
browser.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === micTabId) {
    await setXState(STATE_OFF);
  }
});

/** Listen for voice messages sent from the microphone tab */
browser.runtime.onMessage.addListener(async (request) => {
  switch (request.command) {
    case "ready":
      await setXState(STATE_ON);
      break;
    case "error":
      await setXState(STATE_MIC_ERROR);
      break;
    case "ppn-keyword":
      updateIcon("wake");
      chime.play();
      // Forward the keyword event to the active tab
      messageActiveTab({ ...request });
      break;
    case "wsr-onend":
      messageActiveTab({ ...request });

      // If the user said something, open a Google search tab with their query
      if (request.transcript !== undefined) {
        const encodedQueryParams = encodeURIComponent(
          request.transcript.trim()
        );
        browser.tabs.create({
          url: `${GOOGLE_SEARCH_QUERY_URL}${encodedQueryParams}`,
        });
      }

      // Back to idle state
      await setXState(STATE_ON);
      break;
    case "wsr-onresult":
      messageActiveTab({ ...request });
      break;
  }
});

/** Receive keyboard shortcut commands from browser
 *  Simulate voice events for testing purposes
 * (or, for push-to-talk experience) */
browser.commands.onCommand.addListener((command) => {
  switch (command) {
    case "simWakeWord":
      {
        const message = {
          command: "ppn-keyword",
        };
        messageActiveTab(message);
      }
      break;
    case "simTranscriptionResult":
      {
        const message = {
          command: "wsr-onresult",
          transcript: "test data transcript",
        };
        messageActiveTab(message);
      }
      break;
    default:
      console.log("Unhandled command: " + command);
      break;
  }
});

function onError(e) {
  console.error(e);
}

/** Query for the active tab(s) and send it(them) a message */
async function messageActiveTab(message) {
  const activeTabs = await browser.tabs.query({
    currentWindow: true,
    active: true,
  });

  for (const activeTab of activeTabs) {
    await browser.tabs.sendMessage(activeTab.id, message);
  }
}

async function closeMicTab() {
  // although we're tracking the micTabId,
  // query again for mic tab(s), if for any reason
  // it's out of sync with background.js we want to make sure
  // we actually kill any/all extant mic tabs
  const extantMicTabs = await browser.tabs.query({
    url: MIC_EXTENSION_URL,
  });

  for (const extantMicTab of extantMicTabs) {
    browser.tabs.remove(extantMicTab.id);
  }
  micTabId = -1;
}

async function getOrCreateMicTab() {
  // Do we already have a mic tab?
  const extantMicTabs = await browser.tabs.query({
    url: MIC_EXTENSION_URL,
  });

  if (extantMicTabs.length === 0) {
    const micTab = await browser.tabs.create({
      url: MIC_EXTENSION_URL,
      pinned: true,
    });

    micTabId = micTab.id;
  }
}

const init = async () => {
  // Persist whether the extension is on/off when Chrome restarts
  const dataMicOn = await browser.storage.local.get("micOn");
  if (dataMicOn.micOn === undefined) {
    await browser.storage.local.set({ micOn: true });
    micOnInit = true;
  } else {
    micOnInit = dataMicOn.micOn;
    browserAction();
  }
};

init();
