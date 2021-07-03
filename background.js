import { browser } from "webextension-polyfill-ts";

const GOOGLE_SEARCH_QUERY_URL = "http://google.com/search?q=";

const chimeSfx = document.getElementById("chime");
let micTabId = -1;
let extensionState = "init";

const MIC_EXTENSION_URL = browser.runtime.getURL("/mic/mic.html");
let micOnInit;

async function updateIcon(condition) {
  let path = "../icons/pico-blue.svg";
  switch (condition) {
    case "init":
      path = "../icons/pico-grey-48.png";
      break;
    case "on":
      path = "../icons/pico-blue.svg";
      break;
    case "wake":
      path = "../icons/pico-teal.svg";
      break;
    case "mic-error":
      path = "../icons/pico-pink.svg";
      break;
    case "off":
      path = "../icons/pico-grey-48.png";
      break;
    default:
      break;
  }

  await browser.browserAction.setIcon({ path: path });
}

const setExtensionState = async (newState) => {
  extensionState = newState;
  browser.browserAction.setBadgeText({ text: extensionState });

  if (newState === "off") {
    await browser.storage.local.set({ micOn: false });
  }

  updateIcon(extensionState);
};

const browserAction = async (event) => {
  switch (extensionState) {
    case "init":
      if (micOnInit) {
        await getOrCreateMicTab();
        await setExtensionState("on");
      } else {
        await setExtensionState("off");
      }
      break;
    case "on":
      await setExtensionState("off");
      await closeMicTab();
      await browser.storage.local.set({ micOn: false });
      break;
    case "off":
      await setExtensionState("on");
      await getOrCreateMicTab();
      break;
    case "mic-error":
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
    await setExtensionState("off");
  }
});

/** Listen for voice messages sent from the microphone tab */
browser.runtime.onMessage.addListener(async (request) => {
  switch (request.command) {
    case "ready":
      await setExtensionState("on");
      break;
    case "error":
      await setExtensionState("mic-error");
      break;
    case "ppn-keyword":
      updateIcon("wake");
      chimeSfx.play();
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
      await setExtensionState("on");
      break;
    case "wsr-onresult":
      messageActiveTab({ ...request });
      break;
  }
});

/** Receive keyboard shortcut commands from browser
    Simulate voice events for testing purposes
    (or, for push-to-talk experience) */
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
    default:
      console.log("Unhandled command: " + command);
      break;
  }
});

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
  // Although we're tracking the micTabId,
  // query again for mic tab(s), if for any reason
  // it's out of sync with background.js, we want to make sure
  // we actually destroy any/all extant mic tabs.
  const extantMicTabs = await browser.tabs.query({
    url: MIC_EXTENSION_URL,
  });

  for (const extantMicTab of extantMicTabs) {
    browser.tabs.remove(extantMicTab.id);
  }
  micTabId = -1;
}

async function getOrCreateMicTab() {
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
