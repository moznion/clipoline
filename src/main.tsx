import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@/styles.scss";
import { uploadDataToGoogleDrive } from "@/google_drive";
import type { PageData } from "@/page";

interface AuthToken {
  token: string;
  softExpiration: number;
}

const App: React.FC = () => {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);

  // Function to extract page content
  const extractPageContent = (): Promise<PageData | null> => {
    return new Promise((resolve, reject) => {
      setError(null);
      setUploadSuccess(false);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const activeTab = tabs[0];
          if (activeTab && activeTab.id !== undefined) {
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTab.id },
                func: () => {
                  return {
                    title: document.title,
                    url: window.location.href,
                    content: document.body.textContent || "",
                    html: document.documentElement.outerHTML,
                  };
                },
              },
              (results) => {
                if (chrome.runtime.lastError) {
                  const errorMsg = `Error: ${chrome.runtime.lastError.message}`;
                  setError(errorMsg);
                  reject(new Error(errorMsg));
                } else if (results?.[0]) {
                  const data = results[0].result as PageData;
                  setPageData(data);
                  resolve(data);
                } else {
                  reject(new Error("No results returned"));
                }
              },
            );
          } else {
            const errorMsg = "No active tab ID found";
            setError(errorMsg);
            reject(new Error(errorMsg));
          }
        } else {
          const errorMsg = "No active tabs found";
          setError(errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
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

  const uploadToGoogleDrive = async (data: PageData) => {
    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      const token = await authenticate();
      const result = await uploadDataToGoogleDrive(token, data, {
        mimeType: "text/html",
        fileExtension: "html",
      });
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
    const data = await extractPageContent();
    if (data) {
      await uploadToGoogleDrive(data);
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

      {pageData && (
        <div className="content-preview">
          <h2>Page Content Preview:</h2>
          <p>
            <strong>Title:</strong> {pageData.title}
          </p>
          <p>
            <strong>URL:</strong> {pageData.url}
          </p>
          <p>
            <strong>Content:</strong> {pageData.content.substring(0, 100)}...
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
