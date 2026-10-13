import QRCode from "qrcode";

const generateQrCode = async (token) => {
  if (!token) {
    throw new Error("QR token is required");
  }

  //Data URL convert jwt token to QR image
  const qrDataUrl = await QRCode.toDataURL(token, {
    errorCorrectionLevel: "H", //even if the part of code is damaged/obscured it can still be readable.
    type: "image/png",
    margin: 2,
    width: 500,
  });

  return qrDataUrl;
};

export default generateQrCode;
