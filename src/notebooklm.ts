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

export async function uploadToNotebookLM(notebookId: string, data: UploadData): Promise<string> {
  try {
    // Convert the blob to text for sending to the background script
    const contentText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(data.data);
    });

    // Create a simplified version of the data to send to the background script
    const uploadData = {
      title: data.pageData.title || "Clipped content",
      content: contentText,
      url: data.pageData.url,
      mimeType: data.mimeType,
      fileExtension: data.fileExtension,
    };

    // Send to background script
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "uploadToNotebook",
          notebookId,
          data: uploadData,
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
