import { extractPage as extractPageContent } from "@/page_extractor";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@/styles.scss";
import { uploadDataToGoogleDrive as uploadToGoogleDrive } from "@/google_drive";
import { transformToTextContent } from "@/transformers/text_transformer";
import type { PageData, UploadData } from "@/types";
import { transformToMarkdownContent } from "./transformers/markdown_transformer";

type FileFormat = "text" | "markdown";

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

  const extractAndUpload = async () => {
    const pageData = await extractPageContentAction();
    if (pageData) {
      const transformer =
        fileFormat === "markdown" ? transformToMarkdownContent : transformToTextContent;
      await uploadToGoogleDriveAction(transformer(pageData));
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
