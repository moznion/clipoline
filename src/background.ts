import type { NotebookInfo } from "@/types";
import {
  type Browser,
  connect,
  ExtensionTransport,
} from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "fetchNotebooks") {
    fetchNotebooksBackground()
      .then((notebooks) => sendResponse({ success: true, notebooks }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  if (message.action === "uploadToNotebook") {
    const { notebookId, data } = message;

    if (notebookId && data) {
      pasteToNotebook(notebookId, data)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );

      return true;
    }

    sendResponse({ success: false, error: "Missing notebookId or data" });
    return true;
  }

  return false;
});

async function fetchNotebooksBackground(): Promise<NotebookInfo[]> {
  const tabId = await createTab("https://notebooklm.google.com/", false);

  try {
    return await fetchDataFromNotebookLM(tabId);
  } catch (error) {
    throw new Error(
      `Failed to fetch notebooks: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await chrome.tabs.remove(tabId);
  }
}

async function fetchDataFromNotebookLM(tabId: number): Promise<NotebookInfo[]> {
  const browser = await connect({
    transport: await ExtensionTransport.connectTab(tabId),
  });

  try {
    const [page] = await browser.pages();
    if (!page) {
      throw new Error("failed to open a page");
    }

    await page.setViewport({ width: 1280, height: 800 });

    await page.waitForSelector(".project-button-title");

    const notebooks = await page.$$(".project-button-title");
    if (!notebooks) {
      throw new Error(
        "failed to fetch notebook information; it might have not been signed in to NotebookLM",
      );
    }

    return await Promise.all(
      notebooks.map(async (notebook) => {
        return {
          id: (await (await notebook.getProperty("id")).jsonValue()).replace(/-title$/, ""),
          name: (await (await notebook.getProperty("innerHTML")).jsonValue()).trim(),
        };
      }),
    );
  } finally {
    await browser.disconnect();
  }
}

async function pasteToNotebook(notebookId: string, uploadData: string): Promise<void> {
  const tabId = await createTab(`https://notebooklm.google.com/notebook/${notebookId}`, false);
  let browser: Browser | undefined = undefined;

  const cleanup = async () => {
    await browser?.disconnect();
    await chrome.tabs.remove(tabId);
  };

  try {
    browser = await connect({
      transport: await ExtensionTransport.connectTab(tabId),
    });

    const [page] = await browser.pages();
    if (!page) {
      throw new Error("failed to open a notebook page");
    }
    await page.setViewport({ width: 1280, height: 800 });
    await chrome.tabs.update(tabId, { active: true });
    await page.waitForSelector(".add-source-button", { visible: true });

    setTimeout(async () => {
      try {
        await page.keyboard.press("Escape");
        await (await page.$(".add-source-button"))?.click();
        setTimeout(async () => {
          try {
            const chipGroups = await page.$$(".chip-group .ng-star-inserted");
            await chipGroups[chipGroups.length - 1]?.click();
            await page.waitForSelector("paste-text form textarea", { visible: true });
            await page.$eval(
              "paste-text form textarea",
              (el, value) => {
                el.value = value;
              },
              uploadData,
            );
            await page.focus("paste-text form textarea");
            await page.keyboard.type(" ");
            await page.click('paste-text button[type="submit"]');
          } finally {
            setTimeout(async () => {
              await cleanup();
            }, 500);
          }
        }, 500);
      } catch (error) {
        await cleanup();
        throw new Error(
          `Failed to upload to notebook: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }, 500);
  } catch (error) {
    await cleanup();
    throw new Error(
      `Failed to upload to notebook: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function createTab(url: string, active: boolean): Promise<number> {
  const tab = await chrome.tabs.create({ url, active });
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tabId);
      }
    });
  });
}
