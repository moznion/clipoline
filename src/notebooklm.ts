import type { NotebookInfo, UploadData } from "@/types";

export async function fetchNotebooksList(): Promise<NotebookInfo[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "fetchNotebooks" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error("No response from background service worker"));
        return;
      }

      if (!response.success) {
        reject(new Error(response.error || "Unknown error fetching notebooks"));
        return;
      }

      resolve(response.notebooks);
    });
  });
}

export async function uploadToNotebookLM(
  notebookId: string,
  uploadData: UploadData,
): Promise<string> {
  const arrayBuffer = await uploadData.data.arrayBuffer();
  try {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "uploadToNotebook",
          notebookId,
          uploadData,
          arrayData: Array.from(new Uint8Array(arrayBuffer)),
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error("No response from background service worker"));
            return;
          }

          if (!response.success) {
            reject(new Error(response.error || "Unknown error uploading to notebook"));
            return;
          }

          resolve(
            JSON.stringify({
              success: true,
              notebookId,
              message: response.result || "Content uploaded successfully",
            }),
          );
        },
      );
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload to NotebookLM: ${errorMessage}`);
  }
}
