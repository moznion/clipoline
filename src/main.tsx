import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@/styles.css";

const App: React.FC = () => {
  const [pageContent, setPageContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogButtonClick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id !== undefined) {
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              func: () => {
                return document.body.textContent;
              },
            },
            (results) => {
              if (chrome.runtime.lastError) {
                setError(`Error: ${chrome.runtime.lastError.message}`);
                console.error("Error:", chrome.runtime.lastError);
              } else if (results && results[0]) {
                const content = results[0].result as string;
                setPageContent(content);
                console.log("Web page content:", content);
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

  return (
    <div className="container">
      <h1>Clip Page</h1>
      <button onClick={handleLogButtonClick}>Log to Console</button>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {pageContent && (
        <div className="content-preview">
          <h2>Page Content Preview:</h2>
          <p>{pageContent.substring(0, 100)}...</p>
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
