import React from "react";
import { Modal } from "semantic-ui-react";

const DEFAULT_MODAL_SIZE = "tiny";

export function ModalBasic({ show, size = DEFAULT_MODAL_SIZE, title, children, onClose }) {
  return (
    <Modal className="modal-basic" open={show} onClose={onClose} size={size}>
      {title && <Modal.Header>{title}</Modal.Header>}
      <Modal.Content>{children}</Modal.Content>
    </Modal>
  );
}
