import { useCallback, useState } from "react";

export function useFormModal() {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState(null);
  const [content, setContent] = useState(null);

  const openModal = useCallback((modalTitle, modalContent) => {
    setTitle(modalTitle);
    setContent(modalContent);
    setShow(true);
  }, []);

  const closeModal = useCallback(() => setShow(false), []);

  return { show, title, content, openModal, closeModal };
}
