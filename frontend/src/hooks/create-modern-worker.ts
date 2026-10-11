export const createModernWorker = () => {
  try {
    const worker = new Worker(new URL("../client/client-db/web-worker/web-worker.ts", import.meta.url), {
      type: "module",
    });
    return worker;
  } catch (error) {
    console.log("Modern syntax not supported:", error);
    return null;
  }
};
