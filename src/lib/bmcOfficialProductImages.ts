/** Verified BMC manufacturer media and exact-SKU supplier photos. Generic entries are used only where no exact product photo is available. */
export type BmcOfficialProductImage = {
  image: string;
  gallery: string[];
  sourceUrl: string;
  status: "exact" | "supplier_exact" | "official_generic" | "unconfirmed_code";
};

const BMC_OFFICIAL_PRODUCT_IMAGES: Record<string, BmcOfficialProductImage> = {
  ACCDA120260MUSCLE: {
    image:
      "https://www.bmc-sportluftfilter.de/items/jpg/090@ACCDA120-260Muscle_3.jpg",
    gallery: [
      "https://www.bmc-sportluftfilter.de/items/jpg/090@ACCDA120-260Muscle_3.jpg",
      "https://www.bmc-sportluftfilter.de/items/jpg/090@ACCDA120-260Muscle_2.jpg",
    ],
    sourceUrl: "https://www.bmc-sportluftfilter.de/090%40ACCDA120-260Muscle/BMC-Carbon-Dynamic-Airbox-Nr.-ACCDA120-260Muscle.htm",
    status: "supplier_exact",
  },
  ACCDA10022001: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda100-220-01-1.png?itok=_B_Os08h",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda100-220-01-1.png?itok=_B_Os08h",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda100-220-01-2.png?itok=YvJPiUHI",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda100-220-01-3.png?itok=1sQvuJzh",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accdari-100-220-01-3.png?itok=g_wbAuGN",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/cda/accda100-220-01",
    status: "exact",
  },
  ACCDA85150: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda85-150-1.png?itok=A4I680AF",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda85-150-1.png?itok=A4I680AF",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda85-150-2.png?itok=QJCzsPLM",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda85-150-3.png?itok=iV9QTPot",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/cda/accda85-150",
    status: "exact",
  },
  ACCDA70130: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda70-130-1.png?itok=6k78QEHi",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda70-130-1.png?itok=6k78QEHi",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda70-130-2.png?itok=Wan0Ti5u",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/accda70-130-3.png?itok=QBwbT85R",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/cda/accda70-130",
    status: "exact",
  },
  FB01075: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9275.png?itok=Md20LvVb",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9275.png?itok=Md20LvVb",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9276.png?itok=bGYUCtYA",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9278.png?itok=tZIdnphD",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb01075",
    status: "exact",
  },
  FB59304: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb593_04.jpg?itok=JTxE_1QQ",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb593_04.jpg?itok=JTxE_1QQ",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb593-04",
    status: "exact",
  },
  FB79820: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FB798-20.jpg?itok=C7oO4XDI",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FB798-20.jpg?itok=C7oO4XDI",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb798-20",
    status: "exact",
  },
  FB47304: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb473_04.jpg?itok=e-A6cgkq",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb473_04.jpg?itok=e-A6cgkq",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb473_04-1.png?itok=AC1c_jmC",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb473-04",
    status: "exact",
  },
  ADDIA85150: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia85-150-1.png?itok=l5evRnQS",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia85-150-1.png?itok=l5evRnQS",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia85-150-2.png?itok=huBMrfTs",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia85-150-3.png?itok=tK1EYLRG",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/dia/addia85-150",
    status: "exact",
  },
  ADDIA70130: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia70-130-1.png?itok=Hdd-YQeg",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia70-130-1.png?itok=Hdd-YQeg",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia70-130-2.png?itok=iKxkDUNf",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/addia70-130-3.png?itok=5_la_5zo",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/dia/addia70-130",
    status: "exact",
  },
  FB53608: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8250.png?itok=XbfqNmef",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8250.png?itok=XbfqNmef",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8251.png?itok=ePlhzeMR",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8252.png?itok=UkbsjV4Z",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/unique/fb536-08",
    status: "exact",
  },
  FB69308: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9068.png?itok=MHpsSQF0",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9068.png?itok=MHpsSQF0",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9069.png?itok=K4c-qRvZ",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9070.png?itok=15l16OJt",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/cylindrical/fb693-08",
    status: "exact",
  },
  FB76908: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9337.png?itok=4sUMYnNH",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9337.png?itok=4sUMYnNH",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9338.png?itok=_YpTwVr9",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9339.png?itok=BT3ReKgH",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/cylindrical/fb769-08",
    status: "exact",
  },
  FBTW150206P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-206p-1.png?itok=WRP23Nm4",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-206p-1.png?itok=WRP23Nm4",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-206p-2.png?itok=JkCXkl5z",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-206p-3.png?itok=1gjXzHlc",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw150-206p",
    status: "exact",
  },
  FBTW100200P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-200p.jpg?itok=v5mY7q7-",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-200p.jpg?itok=v5mY7q7-",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-200p._c.jpg?itok=2_Y0h2bc",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-200p_b.jpg?itok=U8mfRr9u",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw100-200p",
    status: "exact",
  },
  FBTW90200P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-200p.jpg?itok=C-CeFLLy",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-200p.jpg?itok=C-CeFLLy",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-200p_b.jpg?itok=N7QR9yLY",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-200p_c.jpg?itok=WqTTDK8_",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw90-200p",
    status: "exact",
  },
  FBTW90300P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FBTW90-300P.jpg?itok=_oi73Q5A",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FBTW90-300P.jpg?itok=_oi73Q5A",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw90-300p",
    status: "exact",
  },
  FBTW76200P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-200p.jpg?itok=sLVocy-4",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-200p.jpg?itok=sLVocy-4",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-200p_b.jpg?itok=YTLIU3bg",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-200p_c.jpg?itok=vhSQI9BJ",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw76-200p",
    status: "exact",
  },
  FBTW100140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-140p.jpg?itok=HJPNQ5m8",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-140p.jpg?itok=HJPNQ5m8",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-140p_b.jpg?itok=WBxqUmZm",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw100-140p_c.jpg?itok=MkSzynSC",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw100-140p",
    status: "exact",
  },
  FBTW110140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-140p-1.png?itok=RLPiqO93",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-140p-1.png?itok=RLPiqO93",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-140p-2.png?itok=U-SvpKzb",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-140p-3.png?itok=m5v2JV3l",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw110-140p",
    status: "exact",
  },
  FBTW130140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8986_0.png?itok=XSJZcb5A",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8986_0.png?itok=XSJZcb5A",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8987.png?itok=1ehhfBGO",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8988_0.png?itok=5kVOabJr",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw130-140p",
    status: "exact",
  },
  FBTW150140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-140p.jpg?itok=57b_pdqo",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-140p.jpg?itok=57b_pdqo",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-140p_b.jpg?itok=Jf4Mat53",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw150-140p_c.jpg?itok=G2oEgqt9",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw150-140p",
    status: "exact",
  },
  FB49420: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb494_20-1.png?itok=ajKF83O_",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb494_20-1.png?itok=ajKF83O_",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb494_20-2.png?itok=hV5i3flk",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb494_20-3.png?itok=vyg6e2hn",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb494-20",
    status: "exact",
  },
  FB21407: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9065.png?itok=A1QA5dfW",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9065.png?itok=A1QA5dfW",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9066.png?itok=QTba2AHN",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_9067.png?itok=4GZKU8f5",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/cylindrical/fb214-07",
    status: "exact",
  },
  FBTW110200P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-200p-1.png?itok=0kfVjE4q",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-200p-1.png?itok=0kfVjE4q",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-200p-2.png?itok=4NAwJq5s",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw110-200p-3.png?itok=hwoHty-9",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw110-200p",
    status: "exact",
  },
  FB74020: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb740_20-1.png?itok=X3-KVAml",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb740_20-1.png?itok=X3-KVAml",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb740_20-2.png?itok=5wC_JAm4",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb740_20-3.png?itok=ot6ffIJA",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb740-20",
    status: "exact",
  },
  FB43001: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb430_01-1.png?itok=yEB1z9jI",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb430_01-1.png?itok=yEB1z9jI",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb430_01-2.png?itok=89YEJO5S",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb430_01-3.png?itok=1v15HJaY",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb430-01",
    status: "exact",
  },
  FB35816: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb358-16-1.png?itok=uwIz2hi3",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb358-16-1.png?itok=uwIz2hi3",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb358-16-2.png?itok=IH8eP_9M",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb358-16-3.png?itok=6m0t7aGQ",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/cylindrical/fb358-16",
    status: "exact",
  },
  FB47620: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb476_20-1.png?itok=WUu_3xgf",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb476_20-1.png?itok=WUu_3xgf",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb476_20-2.png?itok=XYLS_tFU",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb476_20-3.png?itok=-ZlcYM2v",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb476-20",
    status: "exact",
  },
  FB43401: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb434_01-1.png?itok=mVDiDr0E",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb434_01-1.png?itok=mVDiDr0E",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb434_01-2.png?itok=7lIOkVu-",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb434_01-3.png?itok=W2xDDh3H",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb434-01",
    status: "exact",
  },
  FB75620: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb756_20-1.png?itok=lQOcMaXk",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb756_20-1.png?itok=lQOcMaXk",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb756_20-2.png?itok=0P3MX7Fk",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb756_20-3.png?itok=epn1Rcey",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb756-20",
    status: "exact",
  },
  FB40901: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb409_01-1.png?itok=7D3titCl",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb409_01-1.png?itok=7D3titCl",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb409_01-2.png?itok=Znqe8e4U",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb409_01-3.png?itok=TEUr4D8h",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb409-01",
    status: "exact",
  },
  FB96004: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8511.png?itok=vDkgyYWt",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8511.png?itok=vDkgyYWt",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8512.png?itok=nXnFiS5t",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8513.png?itok=7ZB9rpb2",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/cylindrical/fb960-04",
    status: "exact",
  },
  FBTW80151P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-151p.jpg?itok=kGJPFxMP",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-151p.jpg?itok=kGJPFxMP",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-151p_b.jpg?itok=33vyaY4Z",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-151p_c.jpg?itok=OMjPYSkZ",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw80-151p",
    status: "exact",
  },
  FBTW90130PWH: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-130p_profile_0.png?itok=Olq3lJWs",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-130p_profile_0.png?itok=Olq3lJWs",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-130p_stand_0.png?itok=a6GnDSgd",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw90-130p-side_0.png?itok=AryGpGhi",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw90-130pwh",
    status: "exact",
  },
  FBTW90140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8849.png?itok=D1g6WEev",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8849.png?itok=D1g6WEev",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8850.png?itok=rlwmI8LI",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8851.png?itok=kecNJDli",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw90-140p",
    status: "exact",
  },
  FBTW60140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FBTW60-140P.jpg?itok=pEAbzgap",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FBTW60-140P.jpg?itok=pEAbzgap",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw60-140p",
    status: "exact",
  },
  FBTW70140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-140p_alto_sito_2.jpg?itok=VReyF3ag",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-140p_alto_sito_2.jpg?itok=VReyF3ag",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-140p_alto_sito.jpg?itok=eztJNiAe",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-140p_frontale_sito.jpg?itok=au5CEst3",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw70-140p",
    status: "exact",
  },
  FBTW76140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-140p_frontale3_sito.jpg?itok=UXgDdBIV",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-140p_frontale3_sito.jpg?itok=UXgDdBIV",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-140p_frontale_sito2.jpg?itok=2WFH1vNK",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw76-140p_alto_sito.jpg?itok=qKalqZXq",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw76-140p",
    status: "exact",
  },
  FBTW80140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-140p_front.png?itok=fdpsP4OR",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-140p_front.png?itok=fdpsP4OR",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-140p_side.png?itok=c-0cHGUs",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw80-140p_back.png?itok=oSLgBe3i",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw80-140p",
    status: "exact",
  },
  FBTW85140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8858.png?itok=xO0jyDCe",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8858.png?itok=xO0jyDCe",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8859.png?itok=wspgNBe4",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/img_8860.png?itok=I9DXGkZz",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw85-140p",
    status: "exact",
  },
  FB25901: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb259_01-1.png?itok=CJ8xOgbb",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb259_01-1.png?itok=CJ8xOgbb",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb259_01-2.png?itok=6Z_WsRfS",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb259_01-3.png?itok=qtAhkQrc",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb259-01",
    status: "exact",
  },
  FB12001: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/69_fb_120_01.jpg?itok=w3CyZUCv",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/69_fb_120_01.jpg?itok=w3CyZUCv",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/68_fb_120_01.jpg?itok=2raSuhEx",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/70_fb_120_01.jpg?itok=EIC7Bwf0",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb120-01",
    status: "exact",
  },
  FBTW63140P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw63-140p_2_0.jpg?itok=uYP8rPi-",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw63-140p_2_0.jpg?itok=uYP8rPi-",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw63-140p_1_0.jpg?itok=SNFj7t81",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw63-140p",
    status: "exact",
  },
  FB25001: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/109_fb_250-01.jpg?itok=Noz5V9kH",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/109_fb_250-01.jpg?itok=Noz5V9kH",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/110_fb_250-01.jpg?itok=jFvQDOcD",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/111_fb_250-01.jpg?itok=n_Eu-pAh",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb250-01",
    status: "exact",
  },
  FB15101: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/29_fb_151_01.jpg?itok=o9jhfWi0",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/29_fb_151_01.jpg?itok=o9jhfWi0",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/30_fb_151_01.jpg?itok=nIJhuLqA",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/31_fb_151_01.jpg?itok=J25xmAQf",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/car/panel/fb151-01",
    status: "exact",
  },
  FBTW60150P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw60-150p_d.jpg?itok=tgaCIWwH",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw60-150p_d.jpg?itok=tgaCIWwH",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw60-150p_c.jpg?itok=wX79_xFM",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw60-150p.jpg?itok=00wuIva9",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw60-150p",
    status: "exact",
  },
  FBTW65150P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb7w65-150-1.png?itok=6K2REIWh",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb7w65-150-1.png?itok=6K2REIWh",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb7w65-150-2.png?itok=vw2ugzqJ",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fb7w65-150-3.png?itok=85CgcCvo",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw65-150p",
    status: "exact",
  },
  FBTW70150P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-150p_alto_sito_0.jpg?itok=fjK-mKhY",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-150p_alto_sito_0.jpg?itok=fjK-mKhY",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-150p_frontale_2_sito_0.jpg?itok=miMSg8F4",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbtw70-150p_frontale_sito_0.jpg?itok=q8f0yZvy",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbtw70-150p",
    status: "exact",
  },
  FBTS50150P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FBTS50-150P.jpg?itok=GFR2KogE",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/FBTS50-150P.jpg?itok=GFR2KogE",
    ],
    sourceUrl: "https://www.bmcairfilters.com/en/products/engine-filter/twin-air/fbts50-150p",
    status: "exact",
  },
  FBTS60150P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/default_images/bmc-air-filter-fallback_0.jpg?itok=vGFuXQ9a",
    gallery: [],
    sourceUrl: "https://www.bmcairfilters.com/it/products/engine-filter/twin-air/fbts60-150p",
    status: "official_generic",
  },
  FBTS70150P: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/default_images/bmc-air-filter-fallback_0.jpg?itok=vGFuXQ9a",
    gallery: [],
    sourceUrl: "https://www.bmcairfilters.com/it/products/engine-filter/twin-air/fbts70-150p",
    status: "official_generic",
  },
  FBSA2040: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa20-40-1.png?itok=yNDzFn4T",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa20-40-1.png?itok=yNDzFn4T",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa20-40-2.png?itok=ydc67oB9",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa20-40-3.png?itok=XgSXTNAv",
    ],
    sourceUrl:
      "https://www.bmcairfilters.com/it/products/engine-filter/filtri-sfiato-motore/fbsa20-40",
    status: "exact",
  },
  FBSA2540: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa25-40-1.png?itok=y5BMq8jY",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa25-40-1.png?itok=y5BMq8jY",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa25-40-2.png?itok=M2tGeYtT",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa25-40-3.png?itok=8IZyGxoV",
    ],
    sourceUrl:
      "https://www.bmcairfilters.com/it/products/engine-filter/filtri-sfiato-motore/fbsa25-40",
    status: "exact",
  },
  FBSA3040: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa30-40.jpg?itok=WjbWNils",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa30-40.jpg?itok=WjbWNils",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa30-40_b.jpg?itok=ecWDXfwX",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa30-40_c.jpg?itok=_qjUqTJN",
    ],
    sourceUrl:
      "https://www.bmcairfilters.com/it/products/engine-filter/filtri-sfiato-motore/fbsa30-40",
    status: "exact",
  },
  FBSA1240: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa12-40.jpg?itok=nh6lOhVW",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa12-40.jpg?itok=nh6lOhVW",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa12-40_b.jpg?itok=1vZKrSB-",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa12-40_c.jpg?itok=RSEujbnV",
    ],
    sourceUrl:
      "https://www.bmcairfilters.com/it/products/engine-filter/filtri-sfiato-motore/fbsa12-40",
    status: "exact",
  },
  FBSA1640: {
    image:
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa16-40.jpg?itok=1lVWAegd",
    gallery: [
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa16-40.jpg?itok=1lVWAegd",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa16-40_b.jpg?itok=_bRtUcO_",
      "https://www.bmcairfilters.com/sites/default/files/styles/product_slider/public/products/fbsa16-40_c.jpg?itok=NQr7aMXG",
    ],
    sourceUrl:
      "https://www.bmcairfilters.com/it/products/engine-filter/filtri-sfiato-motore/fbsa16-40",
    status: "exact",
  },
};

export function getBmcOfficialProductImage(sku: string | null | undefined) {
  const key = String(sku ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return BMC_OFFICIAL_PRODUCT_IMAGES[key] ?? null;
}
