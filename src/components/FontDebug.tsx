"use client";

import React, { useEffect, useState } from "react";

export default function FontDebug() {
  const [bodyFont, setBodyFont] = useState<string>("");
  const [h1Font, setH1Font] = useState<string>("");

  useEffect(() => {
    const update = () => {
      setBodyFont(getComputedStyle(document.body).fontFamily);
      const h1 = document.querySelector("h1");
      setH1Font(h1 ? getComputedStyle(h1).fontFamily : "");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 99999,
        background: "rgba(0,0,0,0.6)",
        color: "white",
        padding: "8px 10px",
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 6 }}>body: {bodyFont}</div>
      <div>h1: {h1Font}</div>
    </div>
  );
}
