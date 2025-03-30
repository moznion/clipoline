import { extractPage as extractPageContent } from "@/page_extractor";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@/styles.scss";
import { uploadDataToGoogleDrive as uploadToGoogleDrive } from "@/google_drive";
import { fetchNotebooksList, uploadToNotebookLM } from "@/notebooklm";
import { transformToTextContent } from "@/transformers/text_transformer";
import type { Destination, NotebookInfo, PageData, UploadData } from "@/types";
import { transformToMarkdownContent } from "./transformers/markdown_transformer";

type FileFormat = "text" | "markdown" | "pdf";

const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [fileFormat, setFileFormat] = useState<FileFormat>("markdown");
  const [destination, setDestination] = useState<Destination>("GoogleDrive");
  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>("");
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState<boolean>(false);

  const extractPageContentAction = async (): Promise<PageData | null> => {
    setError(null);
    setUploadSuccess(false);

    try {
      return await extractPageContent();
    } catch (err) {
      setError(err as string);
      throw new Error(err as string);
    }
  };

  const authenticate = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!token) {
          reject(new Error("Failed to get auth token"));
          return;
        }

        resolve(token as string);
      });
    });
  };

  const uploadDataAction = async (data: UploadData) => {
    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      let result: string;

      if (destination === "GoogleDrive") {
        const token = await authenticate();
        result = await uploadToGoogleDrive(token, data);
      } else if (destination === "NotebookLM") {
        if (!selectedNotebookId) {
          throw new Error("No notebook selected");
        }
        result = await uploadToNotebookLM(selectedNotebookId, data);
      } else {
        throw new Error(`Unknown destination: ${destination}`);
      }

      setUploadSuccess(true);
      return result;
    } catch (err) {
      setError(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Load notebooks when NotebookLM is selected
  useEffect(() => {
    if (destination === "NotebookLM") {
      setIsLoadingNotebooks(true);
      setError(null);

      fetchNotebooksList()
        .then((notebooksData) => {
          setNotebooks(notebooksData);
          if (notebooksData.length > 0 && notebooksData[0]?.id) {
            setSelectedNotebookId(notebooksData[0].id);
          }
        })
        .catch((err) => {
          setError(`Failed to load notebooks: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          setIsLoadingNotebooks(false);
        });
    }
  }, [destination]);

  interface PrintToPDFResult {
    data: string;
  }

  const extractPDF = async (
    tabId: number,
    paperWidth: number,
    paperHeight: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, "1.3", async () => {
        if (chrome.runtime.lastError) {
          chrome.debugger.detach({ tabId });
          reject(`Failed to attach debugger: ${chrome.runtime.lastError.message}`);
          return;
        }

        chrome.debugger.sendCommand(
          { tabId },
          "Page.printToPDF",
          {
            printBackground: true,
            preferCSSPageSize: true,
            paperWidth,
            paperHeight,
            scale: 0.9,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            pageRanges: "",
            landscape: false,
            displayHeaderFooter: false,
            ignoreInvalidPageRanges: true,
          },
          (result) => {
            chrome.debugger.detach({ tabId });

            if (chrome.runtime.lastError) {
              reject(`Failed to generate PDF: ${chrome.runtime.lastError.message}`);
              return;
            }

            const pdfResult = result as PrintToPDFResult;

            if (!pdfResult || !pdfResult.data) {
              reject("No PDF data returned");
              return;
            }

            resolve(pdfResult.data);
          },
        );
      });
    });
  };

  const extractAndUpload = async () => {
    try {
      const pageData = await extractPageContentAction();
      if (!pageData) return;

      if (fileFormat === "pdf") {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          setError("No active tab found");
          return;
        }

        const activeTab = tabs[0];
        if (!activeTab || activeTab.id === undefined) {
          setError("No active tab ID found");
          return;
        }

        const tabId = activeTab.id;

        const pdfBase64 = await extractPDF(tabId, pageData.paperWidth, pageData.paperHeight);

        const binaryPdf = atob(pdfBase64);

        const arrayBuffer = new ArrayBuffer(binaryPdf.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < binaryPdf.length; i++) {
          uint8Array[i] = binaryPdf.charCodeAt(i);
        }

        // Create blob from array buffer
        const pdfBlob = new Blob([arrayBuffer], { type: "application/pdf" });

        // Create upload data
        const uploadData: UploadData = {
          pageData,
          data: pdfBlob,
          mimeType: "application/pdf",
          fileExtension: "pdf",
        };

        // Upload to selected destination
        await uploadDataAction(uploadData);
      } else {
        // Handle text and markdown formats
        const transformer =
          fileFormat === "markdown" ? transformToMarkdownContent : transformToTextContent;
        await uploadDataAction(transformer(pageData));
      }
    } catch (err) {
      setError(`Extraction error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="container">
      <h1>📎🤸Clipoline</h1>

      <div className="format-selector">
        <h3>File Format</h3>
        <div className="format-row">
          <button
            type="button"
            className={`format-chip ${fileFormat === "markdown" ? "selected" : ""}`}
            onClick={() => setFileFormat("markdown")}
            aria-pressed={fileFormat === "markdown"}
          >
            Markdown
          </button>
          <button
            type="button"
            className={`format-chip ${fileFormat === "text" ? "selected" : ""}`}
            onClick={() => setFileFormat("text")}
            aria-pressed={fileFormat === "text"}
          >
            Plain Text
          </button>
          <button
            type="button"
            className={`format-chip ${fileFormat === "pdf" ? "selected" : ""}`}
            onClick={() => setFileFormat("pdf")}
            aria-pressed={fileFormat === "pdf"}
          >
            PDF
          </button>
        </div>
      </div>

      <div className="destination-selector">
        <h3>Select Destination</h3>
        <div className="destination-options">
          <button
            type="button"
            className={`destination-chip ${destination === "GoogleDrive" ? "selected" : ""}`}
            onClick={() => setDestination("GoogleDrive")}
            aria-pressed={destination === "GoogleDrive"}
          >
            Google Drive
          </button>
          <button
            type="button"
            className={`destination-chip ${destination === "NotebookLM" ? "selected" : ""}`}
            onClick={() => setDestination("NotebookLM")}
            aria-pressed={destination === "NotebookLM"}
          >
            NotebookLM
          </button>
        </div>
      </div>

      {destination === "NotebookLM" && (
        <div className="notebook-selector">
          <h3>Select Notebook</h3>
          {isLoadingNotebooks ? (
            <p>Loading notebooks...</p>
          ) : notebooks.length > 0 ? (
            <select
              value={selectedNotebookId}
              onChange={(e) => setSelectedNotebookId(e.target.value)}
              disabled={isUploading}
            >
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          ) : (
            <p>No notebooks found.</p>
          )}
        </div>
      )}

      <div className="button-group">
        <button
          type="button"
          onClick={extractAndUpload}
          disabled={isUploading || (destination === "NotebookLM" && !selectedNotebookId)}
        >
          {isUploading
            ? `Uploading to ${destination === "GoogleDrive" ? "Google Drive" : "NotebookLM"}...`
            : `Extract & Upload to ${destination === "GoogleDrive" ? "Google Drive" : "NotebookLM"}`}
        </button>
      </div>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {uploadSuccess && (
        <div className="success">
          <p>
            Successfully uploaded to {destination === "GoogleDrive" ? "Google Drive" : "NotebookLM"}
            !
          </p>
        </div>
      )}
    </div>
  );
};

document.addEventListener("DOMContentLoaded", () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
});
