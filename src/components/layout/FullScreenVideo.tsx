import { readVideoConfig } from "@/lib/videoConfig";

export default async function FullScreenVideo() {
  const videoConfig = await readVideoConfig();
  const heroVideo = `/videos/${videoConfig.heroVideo}`;

  return (
    <div className="fixed inset-0 -z-30 h-dvh w-screen">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      >
        <source src={heroVideo} type="video/mp4" />
      </video>
    </div>
  );
}
