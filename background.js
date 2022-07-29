import { browser } from "webextension-polyfill-ts";

const GOOGLE_SEARCH_QUERY_URL = "http://google" +
  ".com/search?q=";

let micTabId = -1;
let extensionState = "init";

const MIC_EXTENSION_URL = browser.runtime.getURL("/mic/mic.html");
let micOnInit;

async function updateIcon(condition) {
  let path = "../icons/pico-blue-16.png";
  switch (condition) {
    case "init":
      path = "../icons/pico-grey-16.png";
      break;
    case "on":
      path = "../icons/pico-blue-16.png";
      break;
    case "wake":
      path = "../icons/pico-teal-16.png";
      break;
    case "mic-error":
      path = "../icons/pico-pink-16.png";
      break;
    case "off":
      path = "../icons/pico-grey-16.png";
      break;
    default:
      break;
  }

  await browser.action.setIcon({ path: path });
}

const setExtensionState = async (newState) => {
  extensionState = newState;
  browser.action.setBadgeText({ text: extensionState });

  if (newState === "off") {
    await browser.storage.local.set({ micOn: false });
  }

  updateIcon(extensionState);
};

const action = async (event) => {
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
browser.action.onClicked.addListener(action);

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
      break;
    case "wsr-onend":

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
    }
      break;
    default:
      console.log("Unhandled command: " + command);
      break;
  }
});

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
    action();
  } else {
    micOnInit = dataMicOn.micOn;
    action();
  }
};

init();
