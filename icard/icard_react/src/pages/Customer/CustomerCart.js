import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Form, Header, Icon, Item, Message, Segment } from "semantic-ui-react";
import { customerApi } from "../../api/customer";
import { useCustomer } from "../../context/CustomerContext";
import { formatPrice, toOrderItems } from "../../utils/cart";
import { CUSTOMER_MAX_ITEMS, CUSTOMER_MAX_QUANTITY } from "../../utils/constants";
import { customerPath } from "../../utils/customerPaths";
import { modifierSummary } from "../../utils/modifiers";
import { notifyError } from "../../utils/notify";

const NOTES_MAX_LENGTH = 255;

export function CustomerCart() {
  const { token, cart, pauseOnThrottle } = useCustomer();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  if (!cart.items.length) {
    return (
      <Message info>
        <Message.Header>Tu carrito está vacío</Message.Header>
        <p>
          Elige algo de la <Link to={customerPath(token)}>carta</Link>.
        </p>
      </Message>
    );
  }

  const tooManyItems = cart.items.length > CUSTOMER_MAX_ITEMS;

  const sendOrder = async () => {
    setSending(true);
    try {
      await customerApi.createOrders(token, toOrderItems(cart.items));
      cart.clear();
      toast.success("Pedido enviado. Ya lo estamos preparando.");
      navigate(customerPath(token, "orders"));
    } catch (error) {
      pauseOnThrottle(error);
      notifyError(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Header as="h2">Tu pedido</Header>
      <Item.Group divided unstackable>
        {cart.items.map((item) => (
          <CartLine key={item.key} item={item} cart={cart} />
        ))}
      </Item.Group>

      {tooManyItems && (
        <Message warning content={`Puedes enviar hasta ${CUSTOMER_MAX_ITEMS} productos distintos por pedido.`} />
      )}

      <Segment clearing>
        <Header as="h3" floated="left">
          Total
        </Header>
        <Header as="h3" floated="right">
          {formatPrice(cart.total)}
        </Header>
      </Segment>

      <Button primary fluid size="large" loading={sending} disabled={sending || tooManyItems} onClick={sendOrder}>
        Enviar pedido
      </Button>
    </>
  );
}

function CartLine({ item, cart }) {
  return (
    <Item>
      <Item.Content>
        <Item.Header>{item.title}</Item.Header>
        {item.modifiers.length > 0 && <Item.Description>{modifierSummary(item.modifiers)}</Item.Description>}
        <Item.Meta>
          {formatPrice(item.price)} × {item.quantity} = {formatPrice(Number(item.price) * item.quantity)}
        </Item.Meta>
        <Item.Description>
          <Button.Group size="mini">
            <Button
              icon="minus"
              aria-label={`Quitar uno de ${item.title}`}
              disabled={item.quantity <= 1}
              onClick={() => cart.setQuantity(item.key, item.quantity - 1)}
            />
            <Button.Or text={item.quantity} />
            <Button
              icon="plus"
              aria-label={`Añadir uno de ${item.title}`}
              disabled={item.quantity >= CUSTOMER_MAX_QUANTITY}
              onClick={() => cart.setQuantity(item.key, item.quantity + 1)}
            />
          </Button.Group>
          <Button basic negative size="mini" floated="right" onClick={() => cart.remove(item.key)}>
            <Icon name="trash" /> Quitar
          </Button>
        </Item.Description>
        <Item.Extra>
          <Form>
            <Form.Input
              size="small"
              placeholder="Notas (ej. sin cebolla)"
              maxLength={NOTES_MAX_LENGTH}
              value={item.notes}
              onChange={(_, data) => cart.setNotes(item.key, data.value)}
            />
          </Form>
        </Item.Extra>
      </Item.Content>
    </Item>
  );
}
