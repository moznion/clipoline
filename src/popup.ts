import "@/styles.css";

chrome.runtime.getPlatformInfo((info) => {
  console.info(`This extension is running on ${info.os}`);
});

console.info("This is a popup!");

const greetUser = (name: string): string => {
  return `Hello, ${name}!`;
};

// Update the DOM when loaded
document.addEventListener("DOMContentLoaded", () => {
  const greeting = greetUser("extension user");
  // Update the greeting element with our message
  const greetingElement = document.getElementById("greeting");
  if (greetingElement) {
    greetingElement.textContent = greeting;
  }
  console.info(greeting);
});
