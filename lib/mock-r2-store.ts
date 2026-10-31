export interface MockStoredPdf {
  bytes: Uint8Array;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: number;
}

const globalForMockR2 = globalThis as unknown as {
  __nuesapediaMockR2?: Map<string, MockStoredPdf>;
};

export const mockR2Store =
  globalForMockR2.__nuesapediaMockR2 ||
  (globalForMockR2.__nuesapediaMockR2 = new Map<string, MockStoredPdf>());

