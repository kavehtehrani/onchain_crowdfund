import { useEffect } from "react";

type ToastProps = {
  message: string;
  type: "success" | "error";
  onHide: () => void;
};

export const Toast = ({ message, type, onHide }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onHide();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg transition-opacity duration-500 ${
        type === "success" ? "bg-success text-success-content" : "bg-error text-error-content"
      }`}
    >
      {message}
    </div>
  );
};
