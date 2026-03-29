import React, { createContext, useContext, useState } from "react";
import { ImageKitProvider } from "@imagekit/react";

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
    <ImageKitProvider
      urlEndpoint="https://ik.imagekit.io/tennistable"
    >
      <ImageKitTimestampContext.Provider
        value={{
          timestamp,
          setTimestamp,
        }}
      >
        {children}
      </ImageKitTimestampContext.Provider>
    </ImageKitProvider>
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
