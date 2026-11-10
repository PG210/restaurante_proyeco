import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Header, Icon, Item, Label, Loader, Message } from "semantic-ui-react";
import { customerApi } from "../../api/customer";
import { useCustomer } from "../../context/CustomerContext";
import { formatPrice } from "../../utils/cart";
import { customerPath } from "../../utils/customerPaths";
import { notifyError } from "../../utils/notify";

export function CustomerCategory() {
  const { categoryId } = useParams();
  const { token, cart, pauseOnThrottle } = useCustomer();
  const [products, setProducts] = useState(null);

  useEffect(() => {
    customerApi
      .getProducts(categoryId)
      .then(setProducts)
      .catch((error) => {
        pauseOnThrottle(error);
        notifyError(error);
        setProducts([]);
      });
  }, [categoryId, pauseOnThrottle]);

  const addProduct = (product) => {
    cart.add(product);
    toast.success(`${product.title} añadido al carrito`, { toastId: `added-${product.id}` });
  };

  return (
    <>
      <Button as={Link} to={customerPath(token)} basic size="small">
        <Icon name="arrow left" /> Categorías
      </Button>
      <Header as="h2">{products?.[0]?.category_data?.title ?? "Productos"}</Header>
      <ProductList products={products} onAdd={addProduct} />
    </>
  );
}

export function ProductList({ products, onAdd }) {
  if (products === null) {
    return (
      <Loader active inline="centered">
        Cargando productos...
      </Loader>
    );
  }
  if (!products.length) return <Message info content="No hay productos disponibles en esta categoría." />;

  return (
    <Item.Group divided unstackable>
      {products.map((product) => (
        <Item key={product.id}>
          <Item.Image size="tiny" src={product.image} alt={product.title} />
          <Item.Content verticalAlign="middle">
            <Item.Header>{product.title}</Item.Header>
            <Item.Meta>{formatPrice(product.price)}</Item.Meta>
            {product.description && <Item.Description>{product.description}</Item.Description>}
            <Item.Extra>
              {product.is_available !== false ? (
                <Button primary size="small" floated="right" onClick={() => onAdd(product)}>
                  <Icon name="plus" /> Añadir
                </Button>
              ) : (
                <Label color="grey" className="right floated">
                  Agotado
                </Label>
              )}
            </Item.Extra>
          </Item.Content>
        </Item>
      ))}
    </Item.Group>
  );
}
