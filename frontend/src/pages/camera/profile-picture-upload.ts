import { upload } from "@imagekit/react";
import { httpClient } from "../../common/http-client";
import { ImageSize } from "./crop-math";

/** The size the app stores. The picture is never shown larger than this. */
const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.9;

type SourceRect = { x: number; y: number; size: number };

/** The frame the camera shows now, as a photo. */
export function frameFromVideo(video: HTMLVideoElement, mirrored: boolean): { url: string; size: ImageSize } {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The browser gave no canvas to take the photo with.");
  }

  // The user frames the photo in a mirror, so the photo keeps the mirror.
  if (mirrored) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0);

  return { url: canvas.toDataURL("image/jpeg", 0.95), size: { width: canvas.width, height: canvas.height } };
}

/** The square the user selects, as a file of 512 by 512 px. */
export async function cropToFile(image: CanvasImageSource, rect: SourceRect, fileName: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The browser gave no canvas to cut the photo with.");
  }
  context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) {
    throw new Error("The browser could not make an image of the photo.");
  }
  return new File([blob], fileName, { type: "image/jpeg" });
}

/** Sends the picture to ImageKit, under the id of the player. */
export async function uploadProfilePicture(file: File, playerId: string): Promise<void> {
  const authUrl = new URL(`${process.env.REACT_APP_API_BASE_URL}/image-kit-auth`);
  const auth = await httpClient(authUrl, { method: "GET" }).then((response) => response.json());

  await upload({
    file,
    fileName: playerId,
    token: auth.token,
    signature: auth.signature,
    expire: auth.expire,
    publicKey: process.env.REACT_APP_IMAGE_KIT_PUBLIC_KEY || "",
    overwriteFile: true,
    useUniqueFileName: false,
  });
}
