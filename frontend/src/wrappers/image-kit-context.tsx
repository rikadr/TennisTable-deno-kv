import React, { createContext, useContext, useState } from "react";
import { IKContext } from "imagekitio-react";
import { httpClient } from "../common/http-client";

// Define the type for our context state
interface ImageKitTimestampContextType {
  timestamp: number;
  setTimestamp: (timestamp: number) => void;
}

const ImageKitTimestampContext = createContext<ImageKitTimestampContextType>({
  timestamp: Date.now(),
  setTimestamp: () => {},
});

export const ImageKitContext: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  return (
    <IKContext
      publicKey={process.env.REACT_APP_IMAGE_KIT_PUBLIC_KEY}
      urlEndpoint="https://ik.imagekit.io/tennistable"
      authenticator={async () => {
        const url = new URL(`${process.env.REACT_APP_API_BASE_URL}/image-kit-auth`);
        return httpClient(url, {
          method: "GET",
        }).then(async (response) => response.json());
      }}
    >
      <ImageKitTimestampContext.Provider
        value={{
          timestamp,
          setTimestamp,
        }}
      >
        {children}
      </ImageKitTimestampContext.Provider>
    </IKContext>
  );
};

/**
 *  Used to clear cache for imagekit when a new image is uploaded
 */
export const useImageKitTimestamp = () => {
  const context = useContext(ImageKitTimestampContext);
  if (context === undefined) {
    throw new Error("useTimestamp must be used within a TimestampProvider");
  }
  return context;
};
