import type { FileType } from "@/file_type";
import type { PageData } from "@/page";

export async function uploadDataToGoogleDrive(token: string, data: PageData, fileType: FileType): Promise<string> {
  const metadata = {
    name: `${data.title || "untitled page"}.${fileType.fileExtension}`,
    mimeType: fileType.mimeType,
    description: `Captured from ${data.url} using Clipoline extension`,
  };

  const requestBody = new FormData();
  requestBody.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  requestBody.append("file", new Blob([data.content], { type: fileType.mimeType }));

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: requestBody,
    },
  );

  return await response.json();
}
