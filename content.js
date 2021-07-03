import { browser } from "webextension-polyfill-ts";

let visualFeedback;

browser.runtime.onMessage.addListener((message) => {
  switch (message.command) {
    case "ppn-keyword": {
      visualFeedback = document.createElement("div");
      visualFeedback.innerHTML = "[Say your search query]";
      visualFeedback.className = "transcript";
      document.body.appendChild(visualFeedback);
      break;
    }
    case "wsr-onresult":
      visualFeedback.innerHTML = message.transcript;
      break;
    case "wsr-onend":
      visualFeedback.innerHTML = message.transcript;
      visualFeedback.remove();
      break;
  }
});
