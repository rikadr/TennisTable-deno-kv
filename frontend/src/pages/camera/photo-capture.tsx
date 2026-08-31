import { useCallback, useEffect, useRef, useState } from "react";
import { classNames } from "../../common/class-names";
import { LoadingButton } from "../../common/loading-button";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useImageKitTimestamp } from "../../wrappers/image-kit-context";
import { useToast } from "../../wrappers/toast-provider";
import { CENTERED, clampCrop, Crop, ImageSize, MAX_SCALE, MIN_SCALE, sourceRect } from "./crop-math";
import { CroppedPhoto } from "./cropped-photo";
import { DraggablePhoto, PhotoStage } from "./photo-stage";
import { cropToFile, frameFromVideo, uploadProfilePicture } from "./profile-picture-upload";
import { useCameraStream } from "./use-camera-stream";

type Props = {
  playerId: string;
  /**
   * The name to use in the text. A new player is not in the projection before
   * the events refetch, so the caller gives the name it knows.
   */
  playerName?: string;
  /** Called after the picture is uploaded and the image cache is refreshed. */
  onUploaded: () => void;
};

type Photo = { url: string; size: ImageSize; fromCamera: boolean };

/** The sizes the app shows a profile picture at, to preview the crop. */
const APP_SIZES = [
  { size: 28, shape: "circle", label: "Leaderboard" },
  { size: 44, shape: "circle", label: "Games" },
  { size: 64, shape: "rounded", label: "Player page" },
] as const;

const secondaryButton =
  "flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-3 font-semibold transition-colors " +
  "bg-primary-background text-primary-text ring-1 ring-primary-text/30 hover:bg-primary-background/70";

/**
 * Takes the profile picture of a player: the camera or a file of the device,
 * then a drag and a zoom to select the square, then the upload. The camera
 * page and the photo step of the new player flow both use it.
 */
export const PhotoCapture: React.FC<Props> = ({ playerId, playerName, onUploaded }) => {
  const context = useEventDbContext();
  const name = playerName ?? context.playerName(playerId);
  const { setTimestamp } = useImageKitTimestamp();
  const { showToast } = useToast();

  const [photo, setPhoto] = useState<Photo>();
  const [crop, setCrop] = useState<Crop>(CENTERED);
  const [stageSize, setStageSize] = useState(320);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string>();

  const camera = useCameraStream(photo === undefined);
  const stage = stageSize > 0 ? stageSize : 320;

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
    }
  }, []);

  // A file of the device holds memory until the browser gets it back.
  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  function startOver() {
    releaseObjectUrl();
    setPhoto(undefined);
    setCrop(CENTERED);
  }

  function takePhoto() {
    const video = camera.videoRef.current;
    if (!video || camera.status !== "live") return;

    try {
      const frame = frameFromVideo(video, camera.facing === "user");
      releaseObjectUrl();
      setCrop(CENTERED);
      setPhoto({ url: frame.url, size: frame.size, fromCamera: true });
    } catch (error) {
      console.error("Could not take the photo:", error);
      showToast("error", "Could not take the photo. Try an image from your device.");
    }
  }

  async function selectFile(file: File) {
    try {
      const url = URL.createObjectURL(file);
      const size = await imageSize(url);
      releaseObjectUrl();
      objectUrlRef.current = url;
      setCrop(CENTERED);
      setPhoto({ url, size, fromCamera: false });
    } catch (error) {
      console.error("Could not read the image:", error);
      showToast("error", "Could not read that image. Select an other file.");
    }
  }

  async function savePhoto() {
    if (!photo) return;
    setIsSaving(true);

    try {
      const image = await loadImage(photo.url);
      const file = await cropToFile(image, sourceRect(photo.size, stage, crop), playerId);
      await uploadProfilePicture(file, playerId);
      setTimestamp(Date.now());
      onUploaded();
    } catch (error) {
      console.error("Error uploading:", error);
      showToast("error", "Could not upload the photo — check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // A width that does not depend on the content keeps the stage the same
    // size in both steps, so the photo stays where the user framed it.
    <div className="flex w-full max-w-[420px] flex-col items-center gap-3">
      <p className="text-center text-sm text-primary-text/70">
        {photo ? "Drag the photo. Zoom with 2 fingers or the slider." : "The circle is the part people see."}
      </p>

      <PhotoStage onSize={setStageSize} guide={camera.status === "live" || photo !== undefined}>
        {photo ? (
          <DraggablePhoto
            imageUrl={photo.url}
            imageSize={photo.size}
            crop={crop}
            stage={stage}
            onCropChange={(update) => setCrop((current) => update(current))}
          />
        ) : (
          <>
            <video
              ref={camera.videoRef}
              playsInline
              muted
              autoPlay
              className={classNames(
                "h-full w-full object-cover",
                camera.facing === "user" && "-scale-x-100",
                camera.status !== "live" && "opacity-0",
              )}
            />
            {camera.status !== "live" && <CameraMessage status={camera.status} />}
          </>
        )}
      </PhotoStage>

      {photo ? (
        <>
          <label className="flex w-full max-w-[420px] items-center gap-3 text-sm text-primary-text/70">
            <span aria-hidden="true">➖</span>
            <input
              type="range"
              aria-label="Zoom"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={crop.scale}
              onChange={(event) =>
                setCrop((current) => clampCrop(photo.size, stage, { ...current, scale: Number(event.target.value) }))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary-background accent-tertiary-background"
            />
            <span aria-hidden="true">➕</span>
          </label>

          <div className="hidden items-end justify-center gap-4 tall:flex">
            {APP_SIZES.map((preview) => (
              <div key={preview.label} className="flex flex-col items-center gap-1">
                <CroppedPhoto
                  imageUrl={photo.url}
                  imageSize={photo.size}
                  crop={crop}
                  stage={stage}
                  size={preview.size}
                  shape={preview.shape}
                />
                <span className="text-[10px] text-primary-text/60">{preview.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="flex w-full max-w-[420px] items-center gap-3 pt-1">
        {photo ? (
          <>
            <button type="button" className={classNames(secondaryButton, "flex-1")} onClick={startOver}>
              {photo.fromCamera ? "↺ Again" : "↺ An other"}
            </button>
            <LoadingButton
              loading={isSaving}
              loadingText="Saving..."
              onClick={savePhoto}
              className="flex-1 whitespace-nowrap rounded-xl bg-tertiary-background px-3 py-3 font-semibold text-tertiary-text ring-1 ring-primary-background transition-colors hover:bg-tertiary-background/75"
            >
              ✓ Use this photo
            </LoadingButton>
          </>
        ) : (
          <>
            <button
              type="button"
              className={classNames(secondaryButton, "flex-1")}
              onClick={() => fileInputRef.current?.click()}
            >
              🖼️ From device
            </button>

            <button
              type="button"
              aria-label={`Take the photo of ${name}`}
              disabled={camera.status !== "live"}
              onClick={takePhoto}
              className={classNames(
                "flex size-16 shrink-0 items-center justify-center rounded-full text-2xl transition-transform",
                "bg-tertiary-background text-tertiary-text ring-4 ring-primary-background active:scale-95",
                camera.status !== "live" && "cursor-not-allowed opacity-40",
              )}
            >
              📸
            </button>

            <div className="flex-1">
              {camera.status === "live" && camera.canFlip && (
                <button
                  type="button"
                  aria-label="Use the other camera"
                  className={classNames(secondaryButton, "w-full")}
                  onClick={camera.flip}
                >
                  🔄 Flip
                </button>
              )}
              {(camera.status === "denied" || camera.status === "unavailable") && (
                <button type="button" className={classNames(secondaryButton, "w-full")} onClick={camera.retry}>
                  ↺ Retry
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // The same file must fire the change again after a take again.
          event.target.value = "";
          file && selectFile(file);
        }}
      />
    </div>
  );
};

const CameraMessage: React.FC<{ status: "starting" | "denied" | "unavailable" }> = ({ status }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary-background px-6 text-center">
    {status === "starting" ? (
      <>
        <div className="size-8 animate-spin rounded-full border-2 border-primary-text border-t-transparent" />
        <p className="text-primary-text">The camera starts...</p>
      </>
    ) : (
      <>
        <span className="text-4xl" aria-hidden="true">
          🚫
        </span>
        <p className="font-semibold text-primary-text">
          {status === "denied" ? "The browser blocks the camera" : "This device gives no camera"}
        </p>
        <p className="text-sm text-primary-text/70">
          {status === "denied"
            ? "Give the camera a permission in the browser, or use an image from your device."
            : "Use an image from your device."}
        </p>
      </>
    )}
  </div>
);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not read the image."));
    image.src = url;
  });
}

async function imageSize(url: string): Promise<ImageSize> {
  const image = await loadImage(url);
  return { width: image.naturalWidth, height: image.naturalHeight };
}
