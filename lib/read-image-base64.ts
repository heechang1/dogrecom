/** FileReader 기반 — data URL에서 순수 base64만 반환 */
export function fileToBase64Payload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      if (typeof s !== "string") {
        reject(new Error("FileReader 결과 형식 오류"));
        return;
      }
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("FileReader 오류"));
    r.readAsDataURL(file);
  });
}

export async function blobUrlToBase64Payload(
  objectUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(objectUrl);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = r.result;
        if (typeof s !== "string") {
          reject(new Error("blob read 형식 오류"));
          return;
        }
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      r.onerror = () => reject(r.error ?? new Error("blob read 오류"));
      r.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("[read-image-base64] blob URL 변환 실패", e);
    return null;
  }
}
