import { readVideoConfig } from "@/lib/videoConfig";
import { inferVideoMimeType, resolveVideoAssetReference } from '@/lib/runtimeAssetPaths';

export default async function FullScreenVideo() {
  const videoConfig = await readVideoConfig();
  const heroVideo = resolveVideoAssetReference(videoConfig.heroVideo);

  if (!heroVideo) {
    return null;
  }

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
        <source src={heroVideo} type={inferVideoMimeType(heroVideo)} />
      </video>
    </div>
  );
}
