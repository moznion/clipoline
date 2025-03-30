export interface PageData {
  title: string;
  url: string;
  content: string;
  entireHTML: string;
  bodyHTML: string;
  paperHeight: number;
  paperWidth: number;
}

export interface UploadData {
  pageData: PageData;
  data: Blob;
  mimeType: string;
  fileExtension: string;
}

export type Destination = "GoogleDrive" | "NotebookLM";

export interface NotebookInfo {
  id: string;
  name: string;
}
