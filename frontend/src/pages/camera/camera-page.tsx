import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import Avatar from "react-avatar-edit";
import { classNames } from "../../common/class-names";
import { useLocation, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { IKUpload } from "imagekitio-react";
import { useImageKitTimestamp } from "../../wrappers/image-kit-context";

export const CameraPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const playerId = queryParams.get("player");

  const [imgUrl, setImgUrl] = useState<string>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [happy, setHappy] = useState(false);
  const webCamRef = useRef<Webcam>(null);
  const [hasMediaStream, setHasMediaStream] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { setTimestamp } = useImageKitTimestamp();

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
    if (!playerId) {
      console.error("No playerId provided");
      return;
    }
    if (!avatarUrl) {
      console.error("No base64 image provided");
      return;
    }

    setIsUploading(true);

    try {
      // Convert the base64 string to a File object
      const file = dataURLtoFile(await compressImage(avatarUrl), playerId);

      // Set the file to the IKUpload input element
      const uploadElement = uploadRef.current;
      if (uploadElement) {
        // Create a DataTransfer object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // Set the files property
        uploadElement.files = dataTransfer.files;

        // Trigger the upload programmatically by dispatching a change event
        const changeEvent = new Event("change", { bubbles: true });
        uploadElement.dispatchEvent(changeEvent);
      } else {
        throw new Error("Upload reference is not available");
      }
    } catch (error) {
      console.error("Error triggering upload:", error);
      setIsUploading(false);
    }
  };

  const btnClassNames = "px-4 py-2 bg-green-700 hover:bg-green-900 text-white rounded-lg font-thin";

  return (
    <div className="flex flex-col gap-4 items-center">
      <h1>Take new profile picture for {context.playerName(playerId)}</h1>
      <p>Or select an image from your device...</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files && setImgUrl(URL.createObjectURL(e.target.files[0]))}
      />
      {!hasMediaStream && (
        <div className="w-[512px] aspect-square flex items-center justify-center">
          <h2>Waiting for camera ...</h2>
        </div>
      )}
      <Webcam
        ref={webCamRef}
        className={classNames(imgUrl && "hidden")}
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
          height={512}
          width={512}
          src={imgUrl}
          onClose={clear}
          onCrop={setAvatarUrl}
          exportAsSquare
          exportMimeType="image/jpeg"
          cropRadius={200}
          minCropRadius={80}
        />
      )}
      {imgUrl && !happy && (
        <button className={btnClassNames} onClick={() => setHappy(true)}>
          Crop!
        </button>
      )}
      {happy && <img src={avatarUrl} alt="avatar" className="w-96 aspect-square" />}
      {happy && (
        <button
          className={classNames(btnClassNames, isUploading && "animate-ping")}
          onClick={async () => avatarUrl && playerId && (await handleFileUpload())}
        >
          {context.playerName(playerId)}, you look great 😘 Submit photo!
        </button>
      )}
      <IKUpload
        className="hidden"
        ref={uploadRef}
        fileName={playerId}
        onSuccess={() => {
          setIsUploading(false);
          // Clear cache for imagekit
          setTimestamp(Date.now());
          navigate(`/player/${playerId}`);
        }}
        onError={() => setIsUploading(false)}
        useUniqueFileName={false}
        overwriteFile={true}
      />
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
