import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventDbContext } from "../../wrappers/event-db-context";
import { ImageKitContext } from "../../wrappers/image-kit-context";
import { ToastProvider } from "../../wrappers/toast-provider";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { PhotoCapture } from "./photo-capture";
import { cropToFile, frameFromVideo, uploadProfilePicture } from "./profile-picture-upload";

// The canvas and the network are the 2 parts jsdom cannot give. The crop of the
// square has its own test in crop-math.test.ts.
jest.mock("./profile-picture-upload", () => ({
  frameFromVideo: jest.fn(),
  cropToFile: jest.fn(),
  uploadProfilePicture: jest.fn(),
}));

const events: EventType[] = [
  { time: 1, stream: "alice-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
];

function renderCapture(onUploaded = jest.fn()) {
  const view = render(
    <ImageKitContext>
      <ToastProvider>
        <EventDbContext.Provider value={new TennisTable({ events })}>
          <PhotoCapture playerId="alice-id" onUploaded={onUploaded} />
        </EventDbContext.Provider>
      </ToastProvider>
    </ImageKitContext>,
  );
  return { ...view, onUploaded };
}

/** The file input is hidden behind the "From device" button. */
function fileInput(container: HTMLElement): HTMLInputElement {
  // eslint-disable-next-line testing-library/no-node-access
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("The file input is missing");
  return input as HTMLInputElement;
}

async function selectAnImage(container: HTMLElement) {
  fireEvent.change(fileInput(container), {
    target: { files: [new File(["photo"], "me.jpg", { type: "image/jpeg" })] },
  });
  expect(await screen.findByRole("slider", { name: "Zoom" })).toBeInTheDocument();
}

beforeAll(() => {
  // jsdom loads no image and makes no object url.
  URL.createObjectURL = jest.fn(() => "blob:photo");
  URL.revokeObjectURL = jest.fn();

  class ImageStub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 1200;
    naturalHeight = 800;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  global.Image = ImageStub as unknown as typeof global.Image;
});

// The jest config of the app resets the mocks before each test, so each test
// gets the implementations here and not from the factory above.
beforeEach(() => {
  (frameFromVideo as jest.Mock).mockReturnValue({
    url: "data:image/jpeg;base64,frame",
    size: { width: 1280, height: 720 },
  });
  (cropToFile as jest.Mock).mockImplementation(async (_image, _rect, fileName: string) => new File(["x"], fileName));
  (uploadProfilePicture as jest.Mock).mockResolvedValue(undefined);
});

describe("taking the profile picture of a player", () => {
  it("says that the device gives no camera, and keeps the way from the device open", () => {
    // jsdom has no mediaDevices, which is the same end as a device with none.
    renderCapture();

    expect(screen.getByText("This device gives no camera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take the photo of Alice/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /From device/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeEnabled();
  });

  it("shows the zoom and the previews after you select an image", async () => {
    const { container } = renderCapture();
    expect(screen.queryByRole("slider", { name: "Zoom" })).not.toBeInTheDocument();

    await selectAnImage(container);

    expect(screen.getByRole("button", { name: /Use this photo/ })).toBeEnabled();
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Player page")).toBeInTheDocument();
    // The camera step is gone, and the take again is now the way back.
    expect(screen.queryByRole("button", { name: /Take the photo of Alice/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /An other/ })).toBeInTheDocument();
  });

  it("uploads the crop under the id of the player, and reports it", async () => {
    const { container, onUploaded } = renderCapture();
    await selectAnImage(container);

    await userEvent.click(screen.getByRole("button", { name: /Use this photo/ }));

    await waitFor(() => expect(uploadProfilePicture).toHaveBeenCalledTimes(1));
    expect(cropToFile).toHaveBeenCalledWith(expect.anything(), expect.any(Object), "alice-id");
    expect(uploadProfilePicture).toHaveBeenCalledWith(expect.any(File), "alice-id");
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it("keeps the user on the photo when the upload fails, and says so", async () => {
    (uploadProfilePicture as jest.Mock).mockRejectedValueOnce(new Error("no network"));
    const { container, onUploaded } = renderCapture();
    await selectAnImage(container);

    await userEvent.click(screen.getByRole("button", { name: /Use this photo/ }));

    expect(await screen.findByText(/Could not upload the photo/)).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Use this photo/ })).toBeEnabled();
  });

  it("goes back to the camera step when you select an other photo", async () => {
    const { container } = renderCapture();
    await selectAnImage(container);

    await userEvent.click(screen.getByRole("button", { name: /An other/ }));

    expect(screen.queryByRole("slider", { name: "Zoom" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take the photo of Alice/ })).toBeInTheDocument();
  });
});
