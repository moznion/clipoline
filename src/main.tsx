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
  const extractPageContent = () => {
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
                setError(`Error: ${chrome.runtime.lastError.message}`);
                console.error("Error:", chrome.runtime.lastError);
              } else if (results && results[0]) {
                const data = results[0].result as PageData;
                setPageData(data);
                console.log("Web page data:", data);
              }
            },
          );
        } else {
          const errorMsg = "No active tab ID found";
          setError(errorMsg);
          console.error(errorMsg);
        }
      } else {
        const errorMsg = "No active tabs found";
        setError(errorMsg);
        console.error(errorMsg);
      }
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
  const uploadToGoogleDrive = async () => {
    if (!pageData) {
      setError("No page data to upload");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      const token = await authenticate();
      
      // Create file metadata
      const metadata = {
        name: `${pageData.title || 'Untitled Page'}.html`,
        mimeType: 'text/html',
        description: `Captured from ${pageData.url} using Clipoline extension`
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
        pageData.html +
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
      console.log('File uploaded successfully:', result);
      setUploadSuccess(true);
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
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
          onClick={extractPageContent}
          disabled={isUploading}
        >
          Extract Page Content
        </button>
        
        <button
          onClick={uploadToGoogleDrive}
          disabled={!pageData || isUploading}
          className={!pageData ? "disabled" : ""}
        >
          {isUploading ? "Uploading..." : "Upload to Google Drive"}
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
