import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@/styles.scss";

interface PageData {
  title: string;
  url: string;
  content: string;
  html: string;
}

interface AuthToken {
  token: string;
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
                    html: document.documentElement.outerHTML
                  };
                },
              },
              (results) => {
                if (chrome.runtime.lastError) {
                  const errorMsg = `Error: ${chrome.runtime.lastError.message}`;
                  setError(errorMsg);
                  reject(new Error(errorMsg));
                } else if (results && results[0]) {
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
      if (authToken) {
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
        };
        
        setAuthToken(newAuthToken);
        chrome.storage.local.set({ authToken: newAuthToken });
        
        resolve(token as string);
      });
    });
  };

  // Function to upload to Google Drive
  const uploadToGoogleDrive = async (data: PageData) => {
    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      const token = await authenticate();
      
      // Create file metadata
      const metadata = {
        name: `${data.title || 'Untitled Page'}.html`,
        mimeType: 'text/html',
        description: `Captured from ${data.url} using Clipoline extension`
      };

      // Create multipart request
      const boundary = 'clipoline_boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      // Construct the multipart request body
      let requestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/html\r\n\r\n' +
        data.html +
        closeDelimiter;

      // Upload to Google Drive
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: requestBody
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Upload failed: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
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
    try {
      const data = await extractPageContent();
      if (data) {
        await uploadToGoogleDrive(data);
      }
    } catch (err) {
      // Error is already set by the individual functions
    }
  };

  // Load auth token from storage on component mount
  useEffect(() => {
    chrome.storage?.local.get(['authToken'], (result) => {
      if (result['authToken']) {
        setAuthToken(result['authToken'] as AuthToken);
      }
    });
  }, []);

  return (
    <div className="container">
      <h1>Clipoline</h1>
      
      <div className="button-group">
        <button
          onClick={extractAndUpload}
          disabled={isUploading}
        >
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
          <p><strong>Title:</strong> {pageData.title}</p>
          <p><strong>URL:</strong> {pageData.url}</p>
          <p><strong>Content:</strong> {pageData.content.substring(0, 100)}...</p>
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
