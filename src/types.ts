export interface PageData {
  title: string;
  url: string;
  content: string;
  entireHTML: string;
  bodyHTML: string;
}

export interface UploadData {
  pageData: PageData;
  data: Blob;
  mimeType: string;
  fileExtension: string;
}
