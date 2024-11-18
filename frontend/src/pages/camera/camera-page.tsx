import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import Avatar from "react-avatar-edit";
import { classNames } from "../../common/class-names";
import { useMutation } from "@tanstack/react-query";
import { httpClient } from "../../common/http-client";
import { useLocation, useNavigate } from "react-router-dom";

export const CameraPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const name = queryParams.get("player");

  const postProfilePicture = useMutation<unknown, Error, { name: string; image: string }, unknown>({
    mutationFn: async ({ name, image }) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/player/${name}/profile-picture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64: image,
        }),
      });
    },
    onSuccess: (_, variables) => {
      navigate(`/player/${variables.name}`);
    },
  });

  const [imgUrl, setImgUrl] = useState<string>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [happy, setHappy] = useState(false);
  const webCamRef = useRef<Webcam>(null);
  const [hasMediaStream, setHasMediaStream] = useState(false);

  function captureWebcam() {
    const img = webCamRef.current?.getScreenshot();
    img && setImgUrl(img);
  }

  function clear() {
    setImgUrl(undefined);
    setAvatarUrl(undefined);
    setHappy(false);
  }

  // Compress and resize image
  async function compressImage(base64Str: string, maxWidth = 256, maxHeight = 256, quality = 0.8): Promise<string> {
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

  const btnClassNames = "px-4 py-2 bg-green-700 hover:bg-green-900 text-white rounded-lg font-thin";

  return (
    <div className="flex flex-col gap-4 items-center">
      <h1>Take new profile picture for {name}</h1>
      <p>Or select an image from your device...</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files && setImgUrl(URL.createObjectURL(e.target.files[0]))}
      />
      {!hasMediaStream && (
        <div className="w-[500px] aspect-square flex items-center justify-center">
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
          width: 500,
          height: 500,
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
          height={500}
          width={500}
          src={imgUrl}
          onClose={clear}
          onCrop={setAvatarUrl}
          exportAsSquare
          exportMimeType="image/jpeg"
          cropRadius={180}
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
          className={btnClassNames}
          onClick={async () =>
            avatarUrl && name && postProfilePicture.mutate({ name: name, image: await compressImage(avatarUrl) })
          }
        >
          You look great 😘 Submit photo!
        </button>
      )}
    </div>
  );
};
