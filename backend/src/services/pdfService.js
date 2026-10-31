const ApiError = require("../utils/ApiError");

let unpdfExtractor = null;

async function getExtractText() {
  if (!unpdfExtractor) {
    try {
      const mod = await import("unpdf");
      unpdfExtractor = mod.extractText;
    } catch {
      try {
        const mod = require("unpdf");
        unpdfExtractor = mod.extractText;
      } catch {
        // Will fall back to pdf-parse
      }
    }
  }
  return unpdfExtractor;
}

/**
 * Extracts plain text and page metadata from an in-memory PDF buffer.
 * Supports modern PDF versions cleanly and gracefully.
 *
 * @param {Buffer|Uint8Array} buffer - Uploaded PDF buffer
 * @returns {Promise<{ text: string, pageCount: number, info: object }>}
 */
const extractTextFromPdf = async (buffer) => {
  if (!buffer || (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array))) {
    throw ApiError.badRequest("Invalid PDF file buffer");
  }

  // unpdf requires pure Uint8Array rather than Node.js Buffer subclass
  const uint8Data = new Uint8Array(
    buffer.buffer || buffer,
    buffer.byteOffset || 0,
    buffer.byteLength || buffer.length
  );

  const extractText = await getExtractText();

  if (extractText) {
    try {
      const { text, totalPages } = await extractText(uint8Data);
      const combinedText = Array.isArray(text) ? text.join("\n").trim() : String(text || "").trim();

      if (combinedText && combinedText.length >= 15) {
        return {
          text: combinedText,
          pageCount: totalPages || 1,
          info: {},
        };
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.message && /password|encrypted/i.test(err.message)) {
        throw ApiError.badRequest(
          "Password-protected or encrypted PDFs are not supported. Please remove the password and re-upload."
        );
      }
    }
  }

  // Secondary fallback with pdf-parse
  try {
    const pdfParse = require("pdf-parse");
    const fallbackData = await pdfParse(buffer);
    const cleaned = (fallbackData.text || "").trim();

    if (!cleaned || cleaned.length < 15) {
      throw ApiError.badRequest(
        "The uploaded PDF does not contain enough readable text. Please upload a standard text PDF rather than an un-OCRed scan."
      );
    }

    return {
      text: cleaned,
      pageCount: fallbackData.numpages || 1,
      info: fallbackData.info || {},
    };
  } catch (parseErr) {
    if (parseErr instanceof ApiError) throw parseErr;
    throw ApiError.badRequest(`Could not parse PDF content: ${parseErr.message}`);
  }
};

module.exports = {
  extractTextFromPdf,
};
