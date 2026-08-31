import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Avatar from "react-avatar-edit";
import { classNames } from "../../common/class-names";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { upload } from "@imagekit/react";
import { useImageKitTimestamp } from "../../wrappers/image-kit-context";
import { useToast } from "../../wrappers/toast-provider";
import { httpClient } from "../../common/http-client";

type Props = {
  playerId: string;
  /**
   * The name to use in the text. A new player is not in the projection before
   * the events refetch, so the caller gives the name it knows.
   */
  playerName?: string;
  /** Called after the photo is uploaded and the image cache is refreshed. */
  onUploaded: () => void;
};

/** The crop editor takes its size in px, so it needs the width it has. */
const MAX_EDITOR_SIZE = 512;

/**
 * Camera capture, crop and upload of a player's profile picture. Used both by
 * the camera page and by the photo step of the new player flow.
 */
export const PhotoCapture: React.FC<Props> = ({ playerId, playerName, onUploaded }) => {
  const context = useEventDbContext();
  const name = playerName ?? context.playerName(playerId);

  const [imgUrl, setImgUrl] = useState<string>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [happy, setHappy] = useState(false);
  const webCamRef = useRef<Webcam>(null);
  const [hasMediaStream, setHasMediaStream] = useState(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { setTimestamp } = useImageKitTimestamp();
  const { showToast } = useToast();
  const sizeRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState(MAX_EDITOR_SIZE);

  // The crop editor draws a canvas of a fixed px size, so a phone needs the
  // width of the column and not the 512 px of a desktop.
  useEffect(() => {
    const element = sizeRef.current;
    if (!element) return;

    const measure = () => setEditorSize(Math.min(element.clientWidth || MAX_EDITOR_SIZE, MAX_EDITOR_SIZE));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function captureWebcam() {
    const img = webCamRef.current?.getScreenshot();
    img && setImgUrl(img);
  }

  function clear() {
    setImgUrl(undefined);
    setAvatarUrl(undefined);
    setHappy(false);
  }

  const handleFileUpload = async () => {
    if (!avatarUrl) {
      console.error("No base64 image provided");
      return;
    }

    setIsUploading(true);

    try {
      const file = dataURLtoFile(await compressImage(avatarUrl), playerId);

      const url = new URL(`${process.env.REACT_APP_API_BASE_URL}/image-kit-auth`);
      const authParams = await httpClient(url, { method: "GET" }).then((response) => response.json());

      await upload({
        file,
        fileName: playerId,
        token: authParams.token,
        signature: authParams.signature,
        expire: authParams.expire,
        publicKey: process.env.REACT_APP_IMAGE_KIT_PUBLIC_KEY || "",
        overwriteFile: true,
        useUniqueFileName: false,
      });

      setIsUploading(false);
      setTimestamp(Date.now());
      onUploaded();
    } catch (error) {
      console.error("Error uploading:", error);
      showToast("error", "Could not upload the photo — check your connection and try again.");
      setIsUploading(false);
    }
  };

  const btnClassNames = "px-4 py-2 bg-green-700 hover:bg-green-900 text-white rounded-lg font-thin";

  return (
    <div className="flex flex-col gap-4 items-center w-full" ref={sizeRef}>
      <p>Take a photo with the camera, or select an image from your device:</p>
      <input
        type="file"
        accept="image/*"
        // An empty FileList is truthy, so the file itself is the guard: a
        // dismissed picker must not reach createObjectURL.
        onChange={(e) => {
          const file = e.target.files?.[0];
          file && setImgUrl(URL.createObjectURL(file));
        }}
      />
      {!hasMediaStream && !imgUrl && (
        <div className="w-full max-w-[512px] aspect-square flex items-center justify-center">
          <h2>Waiting for camera ...</h2>
        </div>
      )}
      <Webcam
        ref={webCamRef}
        className={classNames("w-full max-w-[512px]", imgUrl && "hidden")}
        screenshotFormat="image/png"
        screenshotQuality={100}
        imageSmoothing
        mirrored
        audio={false}
        videoConstraints={{
          width: 512,
          height: 512,
          facingMode: "user",
          noiseSuppression: true,
        }}
        onUserMedia={() => setHasMediaStream(true)}
        onUserMediaError={() => setHasMediaStream(false)}
      />
      {!imgUrl && (
        <button className={btnClassNames} onClick={captureWebcam}>
          Capture
        </button>
      )}
      {imgUrl && !happy && (
        <Avatar
          height={editorSize}
          width={editorSize}
          src={imgUrl}
          onClose={clear}
          onCrop={setAvatarUrl}
          exportAsSquare
          exportMimeType="image/jpeg"
          cropRadius={Math.round(editorSize * 0.39)}
          minCropRadius={Math.round(editorSize * 0.16)}
        />
      )}
      {imgUrl && !happy && (
        <button className={btnClassNames} onClick={() => setHappy(true)}>
          Crop!
        </button>
      )}
      {happy && <img src={avatarUrl} alt="avatar" className="w-96 max-w-full aspect-square" />}
      {happy && (
        <button
          className={classNames(btnClassNames, isUploading && "animate-ping")}
          onClick={async () => avatarUrl && (await handleFileUpload())}
        >
          {name}, you look great 😘 Submit photo!
        </button>
      )}
    </div>
  );
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};

// Compress and resize image
async function compressImage(base64Str: string, maxWidth = 512, maxHeight = 512, quality = 0.9): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      // Set up canvas to draw the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        console.error("Failed to get canvas context.");
        return resolve(base64Str); // fallback if context fails
      }

      // Resize proportionally based on maxWidth and maxHeight
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = (maxHeight / width) * height;
          width = maxWidth;
        } else {
          width = (maxWidth / height) * width;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas back to base64 with compression
      resolve(canvas.toDataURL("image/jpeg", quality)); // Compress using quality parameter
    };
  });
}
