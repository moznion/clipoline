import { extractPage as extractPageContent } from "@/page_extractor";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@/styles.scss";
import { uploadDataToGoogleDrive as uploadToGoogleDrive } from "@/google_drive";
import { transformToTextContent } from "@/transformers/text_transformer";
import type { PageData, UploadData } from "@/types";
import { transformToMarkdownContent } from "./transformers/markdown_transformer";

type FileFormat = "text" | "markdown" | "pdf";

interface AuthToken {
  token: string;
  softExpiration: number;
}

const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [fileFormat, setFileFormat] = useState<FileFormat>("markdown");

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
      if (authToken && authToken.softExpiration <= new Date().getTime()) {
        resolve(authToken.token);
        return;
      }

      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!token) {
          reject(new Error("Failed to get auth token"));
          return;
        }

        const newAuthToken: AuthToken = {
          token: token as string,
          softExpiration: new Date().getTime() + 3600000, // expires in 1 hour
        };

        setAuthToken(newAuthToken);
        chrome.storage.local.set({
          authToken: newAuthToken,
        });

        resolve(token as string);
      });
    });
  };

  const uploadToGoogleDriveAction = async (data: UploadData) => {
    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      const token = await authenticate();
      const result = await uploadToGoogleDrive(token, data);
      setUploadSuccess(true);
      return result;
    } catch (err) {
      setError(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Define the type for the PDF result
  interface PrintToPDFResult {
    data: string;
  }

  const extractPDF = async (
    tabId: number,
    paperWidth: number,
    paperHeight: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Attach debugger to the tab
      chrome.debugger.attach({ tabId }, "1.3", async () => {
        if (chrome.runtime.lastError) {
          chrome.debugger.detach({ tabId });
          reject(`Failed to attach debugger: ${chrome.runtime.lastError.message}`);
          return;
        }

        // Send the Page.printToPDF command with options to capture entire content
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
            // Detach debugger
            chrome.debugger.detach({ tabId });

            if (chrome.runtime.lastError) {
              reject(`Failed to generate PDF: ${chrome.runtime.lastError.message}`);
              return;
            }

            // Cast the result to our expected type
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
        // Get the active tab ID
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

        // Generate PDF using debugger API
        const pdfBase64 = await extractPDF(tabId, pageData.paperWidth, pageData.paperHeight);

        // Convert base64 to binary
        const binaryPdf = atob(pdfBase64);

        // Create array buffer from binary string
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

        // Upload to Google Drive
        await uploadToGoogleDriveAction(uploadData);
      } else {
        // Handle text and markdown formats
        const transformer =
          fileFormat === "markdown" ? transformToMarkdownContent : transformToTextContent;
        await uploadToGoogleDriveAction(transformer(pageData));
      }
    } catch (err) {
      setError(`Extraction error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Load auth token from storage on component mount
  useEffect(() => {
    chrome.storage?.local.get(["authToken"], (result) => {
      // biome-ignore lint/complexity/useLiteralKeys: <explanation>
      if (result["authToken"]) {
        // biome-ignore lint/complexity/useLiteralKeys: <explanation>
        setAuthToken(result["authToken"] as AuthToken);
      }
    });
  }, []);

  return (
    <div className="container">
      <h1>Clipoline</h1>

      <div className="format-selector">
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

      <div className="button-group">
        <button type="button" onClick={extractAndUpload} disabled={isUploading}>
          {isUploading ? "Uploading to Google Drive..." : "Extract & Upload to Google Drive"}
        </button>
      </div>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {uploadSuccess && (
        <div className="success">
          <p>Successfully uploaded to Google Drive!</p>
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
