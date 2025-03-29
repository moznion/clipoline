import type { UploadData } from "@/types";

export async function uploadDataToGoogleDrive(token: string, data: UploadData): Promise<string> {
  const metadata = {
    name: `${data.pageData.title || "untitled page"}.${data.fileExtension}`,
    mimeType: data.mimeType,
    description: `Captured from ${data.pageData.url} using Clipoline extension`,
  };

  const requestBody = new FormData();
  requestBody.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  requestBody.append("file", data.data);

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
