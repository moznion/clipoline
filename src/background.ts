// Background service worker for Clipoline extension
import type { NotebookInfo } from "@/types";

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
      uploadToNotebookBackground(notebookId, data)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );

      return true; // Indicate we're sending response asynchronously
    }

    sendResponse({ success: false, error: "Missing notebookId or data" });
    return true;
  }

  return false;
});

async function fetchNotebooksBackground(): Promise<NotebookInfo[]> {
  const tabId = await createBackgroundTab("https://notebooklm.google.com/");

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
  const maxRetry = 10;
  let retry = 0;

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      if (retry >= maxRetry) {
        reject(
          "failed to fetch notebook information; it might have not been signed in to NotebookLM",
        );
        clearInterval(interval);
        return;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const elements = document.getElementsByClassName("project-button-title");
          return Array.from(elements).map((el) => {
            return {
              id: el.id.replace(/-title$/, ''),
              name: (el as HTMLElement).innerText,
            };
          });
        },
      });

      if (result?.length >= 0 && result[0]?.result) {
        resolve(result[0].result);
        clearInterval(interval);
        return;
      }

      retry++;
    }, 500);
  });
}

async function createOrGetHiddenTab(): Promise<number> {
  try {
    // Otherwise, create a new tab (will be hidden/inactive)
    const tab = await chrome.tabs.create({
      url: "https://notebooklm.google.com/",
      active: false, // Keep it in the background
    });

    if (!tab.id) {
      throw new Error("Failed to create tab");
    }

    return tab.id;
  } catch (error) {
    throw new Error(`Error creating hidden tab: ${error}`);
  }
}

// Function to upload to a notebook in the background
async function uploadToNotebookBackground(notebookId: string, uploadData: any): Promise<string> {
  try {
    // Create or get hidden tab
    const tabId = await createOrGetHiddenTab();

    // Navigate to specific notebook
    await chrome.tabs.update(tabId, {
      url: `https://notebooklm.google.com/notebook/${notebookId}`,
    });

    // Wait for notebook page to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Wait for content to be visible
    await new Promise((resolve, reject) => {
      const maxAttempts = 20; // 10 seconds max (500ms intervals)
      let attempts = 0;

      const checkPageLoaded = async () => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (expectedId) => {
              const currentUrl = window.location.href;
              return (
                currentUrl.includes(`/notebook/${expectedId}`) &&
                (document.querySelector(".editor-container") !== null ||
                  document.querySelector(".note-editor") !== null ||
                  document.querySelector(".notes-list") !== null)
              );
            },
            args: [notebookId],
          });

          if (results?.[0]?.result) {
            resolve(true);
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error("Timeout waiting for notebook page to load"));
            return;
          }

          setTimeout(checkPageLoaded, 500);
        } catch (error) {
          reject(error);
        }
      };

      // Start checking
      checkPageLoaded();
    });

    // Execute script to add the content
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (data) => {
        return new Promise<string>((resolve, reject) => {
          try {
            // Extract data
            const { title, content, url } = data;

            // Find the "Add note" or equivalent button
            const addNoteButton = Array.from(document.querySelectorAll("button")).find(
              (button) =>
                button.textContent?.includes("Add note") ||
                button.textContent?.includes("New note") ||
                button.getAttribute("aria-label")?.includes("note"),
            );

            if (!addNoteButton) {
              throw new Error("Could not find 'Add note' button");
            }

            // Click the button to open the editor
            addNoteButton.click();

            // Wait for the editor to appear
            setTimeout(() => {
              // Find the title input and content area
              const titleInput = document.querySelector(
                'input[placeholder*="title"], input[aria-label*="title"]',
              );
              const contentArea = document.querySelector(
                '[contenteditable="true"], textarea.note-content, div.note-editor',
              );

              // If we couldn't find the expected elements, try more generic selectors
              const allInputs = document.querySelectorAll("input");
              const allTextareas = document.querySelectorAll("textarea");
              const allEditableAreas = document.querySelectorAll('[contenteditable="true"]');

              if (titleInput instanceof HTMLInputElement) {
                // Set the title
                titleInput.value = title;
                titleInput.dispatchEvent(new Event("input", { bubbles: true }));
              } else if (allInputs.length > 0) {
                // Try the first input as a fallback
                const input = allInputs[0] as HTMLInputElement;
                input.value = title;
                input.dispatchEvent(new Event("input", { bubbles: true }));
              }

              // Set the content
              if (contentArea) {
                if (contentArea instanceof HTMLTextAreaElement) {
                  contentArea.value = `${content}\n\nSource: ${url}`;
                  contentArea.dispatchEvent(new Event("input", { bubbles: true }));
                } else if (contentArea instanceof HTMLElement) {
                  contentArea.textContent = `${content}\n\nSource: ${url}`;
                  contentArea.dispatchEvent(new Event("input", { bubbles: true }));
                }
              } else if (allTextareas.length > 0) {
                // Try the first textarea as a fallback
                const textarea = allTextareas[0] as HTMLTextAreaElement;
                textarea.value = `${content}\n\nSource: ${url}`;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
              } else if (allEditableAreas.length > 0) {
                // Try the first contenteditable element as a fallback
                const editable = allEditableAreas[0] as HTMLElement;
                editable.textContent = `${content}\n\nSource: ${url}`;
                editable.dispatchEvent(new Event("input", { bubbles: true }));
              }

              // Find and click the save/submit button after a short delay
              setTimeout(() => {
                const saveButton = Array.from(document.querySelectorAll("button")).find(
                  (button) =>
                    button.textContent?.includes("Save") ||
                    button.textContent?.includes("Create") ||
                    button.textContent?.includes("Add") ||
                    button.getAttribute("aria-label")?.includes("save"),
                );

                if (saveButton) {
                  saveButton.click();

                  // Signal success after giving time for the save to complete
                  setTimeout(() => {
                    resolve("Content uploaded successfully");
                  }, 2000);
                } else {
                  reject("Could not find save button");
                }
              }, 1000);
            }, 1500);
          } catch (error) {
            reject(`Error in content script: ${error}`);
          }
        });
      },
      args: [uploadData],
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error("Failed to execute upload script");
    }

    return results[0].result as string;
  } catch (error) {
    throw new Error(
      `Failed to upload to notebook: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function createBackgroundTab(url: string): Promise<number> {
  const tab = await chrome.tabs.create({ url, active: false });
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tabId);
      }
    });
  });
}
