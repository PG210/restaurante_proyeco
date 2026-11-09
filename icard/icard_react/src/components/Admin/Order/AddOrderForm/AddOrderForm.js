import React, { useEffect, useRef, useState } from "react";
import { Button, Form, List } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import "./AddOrderForm.scss";
import { useOrder, useProduct } from "../../../../hooks";
import { notifyError } from "../../../../utils/notify";

const MIN_QUANTITY = 1;
const NOTES_MAX_LENGTH = 255;
const ACTIVE_PRODUCTS_FILTER = { active: true };

export function AddOrderForm({ tableId, onClose, onRefetch }) {
  const { products, getProducts } = useProduct();
  const { addOrders } = useOrder();
  const [items, setItems] = useState([]);
  const [sending, setSending] = useState(false);
  const nextItemKey = useRef(0);

  useEffect(() => {
    getProducts(ACTIVE_PRODUCTS_FILTER).catch(notifyError);
  }, [getProducts]);

  const formik = useFormik({
    initialValues: initialItemValues(),
    validationSchema: Yup.object(itemSchema()),
    validateOnChange: false,
    onSubmit: (formValue, { resetForm }) => {
      const product = products.find((candidate) => candidate.id === formValue.product);
      nextItemKey.current += 1;
      setItems((current) => [
        ...current,
        { ...formValue, key: nextItemKey.current, title: product?.title ?? "" },
      ]);
      resetForm();
    },
  });

  const removeItem = (key) => setItems((current) => current.filter((item) => item.key !== key));

  const sendOrder = async () => {
    setSending(true);
    try {
      await addOrders(tableId, items.map(toOrderItem));
      onRefetch();
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="add-order-form">
      <Form onSubmit={formik.handleSubmit}>
        <Form.Dropdown
          name="product"
          placeholder="Producto"
          fluid
          search
          selection
          options={toProductOptions(products)}
          value={formik.values.product}
          error={formik.errors.product}
          onChange={(_, data) => formik.setFieldValue("product", data.value)}
        />
        <Form.Group widths="equal">
          <Form.Input
            type="number"
            min={MIN_QUANTITY}
            name="quantity"
            placeholder="Cantidad"
            value={formik.values.quantity}
            onChange={formik.handleChange}
            error={formik.errors.quantity}
          />
          <Form.Input
            name="notes"
            placeholder="Notas (opcional)"
            value={formik.values.notes}
            onChange={formik.handleChange}
            error={formik.errors.notes}
          />
        </Form.Group>
        <Button type="submit" fluid content="Agregar a la lista" />
      </Form>

      <List divided className="add-order-form__items">
        {items.map((item) => (
          <List.Item key={item.key}>
            <List.Content floated="right">
              <Button icon="close" size="mini" basic negative onClick={() => removeItem(item.key)} />
            </List.Content>
            <List.Content>
              {item.quantity} × {item.title}
              {item.notes && <List.Description>{item.notes}</List.Description>}
            </List.Content>
          </List.Item>
        ))}
      </List>

      <Button
        primary
        fluid
        disabled={!items.length}
        loading={sending}
        content={`Enviar pedido (${items.length})`}
        onClick={sendOrder}
      />
    </div>
  );
}

function toProductOptions(products) {
  return (products || []).map((product) => ({
    key: product.id,
    text: `${product.title} — $${product.price}`,
    value: product.id,
  }));
}

function toOrderItem({ product, quantity, notes }) {
  return { product, quantity: Number(quantity), notes };
}

function initialItemValues() {
  return { product: "", quantity: MIN_QUANTITY, notes: "" };
}

function itemSchema() {
  return {
    product: Yup.number().required("Elige un producto"),
    quantity: Yup.number().integer().min(MIN_QUANTITY).required(true),
    notes: Yup.string().max(NOTES_MAX_LENGTH),
  };
}
