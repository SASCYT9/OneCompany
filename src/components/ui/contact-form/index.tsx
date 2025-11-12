"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./styles.module.scss";
import { useTranslations } from "next-intl";

const ContactForm = ({ isOpen, onClose }) => {
  const t = useTranslations("contactForm");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: "auto", // Set a default value
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      onClose();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} data-testid="contact-form-modal">
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        <h2>{t("title")}</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.formGroup}>
            <label>{t("requestType")}</label>
            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="auto"
                  {...register("type", { required: true })}
                />
                {t("auto")}
              </label>
              <label>
                <input
                  type="radio"
                  value="moto"
                  {...register("type", { required: true })}
                />
                {t("moto")}
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="carModel">{t("model")}</label>
            <input
              type="text"
              id="carModel"
              {...register("carModel", { required: t("fieldRequired") })}
            />
            {errors.carModel && (
              <p className={styles.error}>{errors.carModel.message}</p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="vin">{t("vin")}</label>
            <input
              type="text"
              id="vin"
              {...register("vin", { required: t("fieldRequired") })}
            />
            {errors.vin && <p className={styles.error}>{errors.vin.message}</p>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="wishes">{t("wishes")}</label>
            <textarea
              id="wishes"
              {...register("wishes", {
                required: t("fieldRequired"),
              })}
            ></textarea>
            {errors.wishes && (
              <p className={styles.error}>{errors.wishes.message}</p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="budget">{t("budget")}</label>
            <input
              type="text"
              id="budget"
              {...register("budget", { required: t("fieldRequired") })}
            />
            {errors.budget && (
              <p className={styles.error}>{errors.budget.message}</p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">{t("email")}</label>
            <input
              type="email"
              id="email"
              {...register("email", { required: t("fieldRequired") })}
            />
            {errors.email && (
              <p className={styles.error}>{errors.email.message}</p>
            )}
          </div>

          {submitError && <p className={styles.error}>{submitError}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactForm;
