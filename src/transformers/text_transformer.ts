import type { PageData, UploadData } from "@/types";

export function transformToTextContent(pageData: PageData): UploadData {
  const mimeType = "text/plain";

  return {
    pageData,
    data: new Blob([pageData.content], { type: mimeType }),
    mimeType,
    fileExtension: "txt",
  };
}
