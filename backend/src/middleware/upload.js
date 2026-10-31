const multer = require("multer");
const ApiError = require("../utils/ApiError");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfExt = /\.pdf$/i.test(file.originalname);

  if (isPdfMime || isPdfExt) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("Only PDF documents are supported"), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
  },
  fileFilter,
});

module.exports = upload;

