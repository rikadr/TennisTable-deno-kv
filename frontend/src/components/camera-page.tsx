import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";

export const CameraPage: React.FC = () => {
  const [imgUrl, setImgUrl] = useState<string>();
  const webCamRef = useRef<Webcam>(null);
  const [hasMediaStream, setHasMediaStream] = useState(false);

  function captureWebcam() {
    const img = webCamRef.current?.getScreenshot();
    img && setImgUrl(img);
  }

  const captureInput = (target: EventTarget & HTMLInputElement) => {
    if (target.files && target.files.length !== 0) {
      const file = target.files[0];
      const newUrl = URL.createObjectURL(file);
      setImgUrl(newUrl);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        to="/leader-board"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <h1>Camera page</h1>
      <input
        accept="image/*"
        id="icon-button-file"
        type="file"
        capture="user"
        onChange={(e) => captureInput(e.target)}
      />
      <p>Soon you might be able to set your player profile picture</p>
      {imgUrl && <img src={imgUrl} alt="captured" />}
      {!hasMediaStream && (
        <div className="w-[500px] aspect-square flex items-center justify-center">
          <h2>Waiting for camera ...</h2>
        </div>
      )}
      <Webcam
        ref={webCamRef}
        className={classNames(imgUrl ? "hidden" : "")}
        screenshotFormat="image/jpeg"
        screenshotQuality={1}
        imageSmoothing
        mirrored
        audio={false}
        videoConstraints={{ width: 500, height: 500, facingMode: "user", aspectRatio: 1, noiseSuppression: true }}
        onUserMedia={() => setHasMediaStream(true)}
        onUserMediaError={() => setHasMediaStream(false)}
      />
      {imgUrl ? (
        <button onClick={() => setImgUrl(undefined)}>Clear</button>
      ) : (
        <button onClick={captureWebcam}>Capture</button>
      )}
    </div>
  );
};
