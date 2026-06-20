/** Read a File/Blob into a base64 data URI (for sending images to API routes). */
export function fileToDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Centimeters → meters. */
export function cmToM(cm: number): number {
  return cm / 100;
}
