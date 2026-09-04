import { Logo } from "./Logo";
import styles from "./BrandedLoadingScreen.module.css";

type BrandedLoadingScreenProps = { exiting?: boolean };

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
        <div className={styles.wheelLight} />
      </div>
      <div className={styles.content} aria-hidden="true">
        <Logo tone="light" className={styles.logoAsset} priority />
        <div className={styles.progress}>
          <span />
          <span />
          <span />
        </div>
      </div>
      <p className={styles.caption} aria-hidden="true">
        Performance in every detail
      </p>
    </div>
  );
}
export default BrandedLoadingScreen;
