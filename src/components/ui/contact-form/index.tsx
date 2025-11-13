"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./styles.module.scss";

interface ContactFormData {
  type: string;
  carModel: string;
  vin: string;
  wishes: string;
  budget: string;
  email: string;
}

const ContactForm = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    defaultValues: {
      type: "auto", // Set a default value
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const onSubmit = async (data: any) => {
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
    } catch (error: any) {
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
        <h2>Contact Us</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.formGroup}>
            <label>Request Type</label>
            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="auto"
                  {...register("type", { required: true })}
                />
                Automotive
              </label>
              <label>
                <input
                  type="radio"
                  value="moto"
                  {...register("type", { required: true })}
                />
                Motorcycles
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="carModel">Car/Bike Model</label>
            <input
              type="text"
              id="carModel"
              {...register("carModel", { required: "This field is required" })}
            />
            {errors.carModel && (
              <p className={styles.error}>{errors.carModel.message}</p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="vin">VIN</label>
            <input
              type="text"
              id="vin"
              {...register("vin", { required: "This field is required" })}
            />
            {errors.vin && <p className={styles.error}>{errors.vin.message}</p>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="wishes">Your Wishes</label>
            <textarea
              id="wishes"
              {...register("wishes", {
                required: "This field is required",
              })}
            ></textarea>
            {errors.wishes && (
              <p className={styles.error}>{errors.wishes.message}</p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="budget">Budget</label>
            <input
              type="text"
              id="budget"
              {...register("budget", { required: "This field is required" })}
            />
            {errors.budget && (
              <p className={styles.error}>{errors.budget.message}</p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              {...register("email", { required: "This field is required" })}
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
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactForm;
