import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";
import Avatar from "react-avatar-edit";

export const CameraPage: React.FC = () => {
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

  const btnClassNames = "px-4 py-2 bg-green-700 hover:bg-green-900 text-white rounded-lg font-thin";

  return (
    <div className="flex flex-col gap-4 items-center">
      <Link
        to="/leader-board"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <h1>Camera page</h1>
      <p>Soon you might be able to set your player profile picture</p>
      {!hasMediaStream && (
        <div className="w-[500px] aspect-square flex items-center justify-center">
          <h2>Waiting for camera ...</h2>
        </div>
      )}
      <Webcam
        ref={webCamRef}
        className={classNames(imgUrl && "hidden")}
        screenshotFormat="image/jpeg"
        screenshotQuality={1}
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
      {imgUrl && !happy && <Avatar height={500} width={500} src={imgUrl} onClose={clear} onCrop={setAvatarUrl} />}
      {imgUrl && !happy && (
        <button className={btnClassNames} onClick={() => setHappy(true)}>
          Happy!
        </button>
      )}
      {happy && <img src={avatarUrl} alt="avatar" className="w-96 aspect-square" />}
      {happy && (
        <button className={btnClassNames} onClick={clear}>
          You look great 😘 Try again
        </button>
      )}
    </div>
  );
};
