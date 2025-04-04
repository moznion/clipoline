import type { PageData } from "@/types";

export function extractPage(): Promise<PageData> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length <= 0) {
        reject("No active tab ID found");
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab || activeTab.id === undefined) {
        reject("No active tab ID found");
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          func: () => {
            const dpi = 96;
            return {
              title: document.title,
              url: window.location.href,
              content: document.body.textContent || "",
              entireHTML: document.documentElement.outerHTML,
              bodyHTML: document.body.outerHTML,
              paperHeight: document.body.scrollHeight / dpi,
              paperWidth: document.body.scrollWidth / dpi,
            };
          },
        },
        (results) => {
          if (chrome.runtime.lastError) {
            reject(`Error: ${chrome.runtime.lastError.message}`);
            return;
          }

          if (results?.[0]) {
            const data = results[0].result as PageData;
            resolve(data);
            return;
          }

          reject("No results returned");
        },
      );
    });
  });
}
