import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Filters DKIM headers to keep only ethglobal.com signatures
 */
export function filterDKIMHeaders(emailContent: string): string {
  // Split email into lines for processing
  const lines = emailContent.split("\n");

  let filteredLines: string[] = [];
  let isDKIMBlock = false;
  let isEthGlobalDKIM = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is the start of a DKIM-Signature header
    if (line.startsWith("DKIM-Signature:")) {
      isDKIMBlock = true;
      // Check if this is an ethglobal.com DKIM signature
      isEthGlobalDKIM = line.includes("d=ethglobal.com");

      // Only keep the line if it's from ethglobal.com
      if (isEthGlobalDKIM) {
        filteredLines.push(line);
      }
      continue;
    }

    // Handle continuation of DKIM header (lines starting with whitespace)
    if (isDKIMBlock && (line.startsWith(" ") || line.startsWith("\t"))) {
      if (isEthGlobalDKIM) {
        filteredLines.push(line);
      }
      continue;
    }

    // If we reach here, we're no longer in a DKIM block
    isDKIMBlock = false;
    isEthGlobalDKIM = false;
    filteredLines.push(line);
  }

  return filteredLines.join("\n");
}
