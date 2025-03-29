import type { PageData, UploadData } from "@/types";
import TurndownService from "turndown";

export function transformToMarkdownContent(pageData: PageData): UploadData {
  const mimeType = "text/markdown";

  return {
    pageData,
    data: new Blob([new TurndownService().turndown(pageData.bodyHTML)], { type: mimeType }),
    mimeType,
    fileExtension: "md",
  };
}
