import { Logo } from "./Logo";
import styles from "./BrandedLoadingScreen.module.css";

type BrandedLoadingScreenProps = {
  exiting?: boolean;
};

export function BrandedLoadingScreen({ exiting = false }: BrandedLoadingScreenProps) {
  return (
    <div
      className={styles.screen}
      data-exiting={exiting ? "true" : "false"}
      role="status"
      aria-live="polite"
      aria-label="ONE COMPANY loading"
    >
      <div className={styles.wheelReveal} aria-hidden="true">
        <div className={styles.wheelMotion} />
      </div>

      <div className={styles.content} aria-hidden="true">
        <div className={styles.orbit}>
          <span className={styles.orbitPoint} />
        </div>

        <div className={styles.logoStage}>
          <Logo tone="auto" className={styles.logoAsset} priority />
          <span className={styles.logoReflection} />
          <span className={styles.logoMark} />
          <span className={styles.logoSweep} />
        </div>

        <div className={styles.progress}>
          <span className={styles.progressSegment} />
          <span className={styles.progressSegment} />
          <span className={styles.progressSegment} />
        </div>
      </div>
    </div>
  );
}

export default BrandedLoadingScreen;
