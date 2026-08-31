import { useCallback, useEffect, useRef, useState } from "react";

export type CameraFacing = "user" | "environment";

export type CameraStatus = "starting" | "live" | "denied" | "unavailable";

type Camera = {
  /** Attach it to the video element that shows the camera. */
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  facing: CameraFacing;
  /** True when the device has a front camera and a back camera. */
  canFlip: boolean;
  flip: () => void;
  retry: () => void;
};

/**
 * The camera of the device, as a stream in a video element. It gives a status
 * for each end state, so the screen can say what happened: a camera the user
 * blocks is not a camera that is still starting.
 *
 * The stream stops on unmount and on each new request, so the light of the
 * camera goes off when the user leaves.
 */
export function useCameraStream(active: boolean): Camera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream>();
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [canFlip, setCanFlip] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    // An insecure context and an old browser have no camera to give.
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

    let cancelled = false;
    setStatus("starting");

    // getUserMedia rejects for a permission, and it can also throw at the call
    // itself, for a policy of the page. An error that leaves this effect
    // unmounts the whole page, so everything is inside the try.
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stop();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Safari on iOS needs the play call, and it rejects if the element
          // leaves the page first.
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus("live");

        // The label of a camera is empty before a permission, so the count of
        // the cameras is known only now.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) {
          setCanFlip(devices.filter((device) => device.kind === "videoinput").length > 1);
        }
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    };

    start();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, facing, attempt, stop]);

  // The camera keeps running while the component lives, and stops with it.
  useEffect(() => stop, [stop]);

  return {
    videoRef,
    status,
    facing,
    canFlip,
    flip: () => setFacing((current) => (current === "user" ? "environment" : "user")),
    retry: () => setAttempt((count) => count + 1),
  };
}
