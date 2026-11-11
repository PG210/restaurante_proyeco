import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Header, Icon, Item, Label, Loader, Message } from "semantic-ui-react";
import { customerApi } from "../../api/customer";
import { useCustomer } from "../../context/CustomerContext";
import { ModalBasic, ModifierDialog } from "../../components/Common";
import { useMenuFilters } from "../../hooks";
import { formatPrice } from "../../utils/cart";
import { menuPreparationText } from "../../utils/preparation";
import { ALLERGEN_NOTICE, filterMenu, hiddenMessage } from "../../utils/labels";
import { hasModifiers } from "../../utils/modifiers";
import { customerPath } from "../../utils/customerPaths";
import { notifyError } from "../../utils/notify";
import { MenuFilters, ProductLabels } from "./MenuFilters";

export function CustomerCategory() {
  const { categoryId } = useParams();
  const { token, cart, pauseOnThrottle } = useCustomer();
  const [products, setProducts] = useState(null);
  const [choosing, setChoosing] = useState(null);
  const { labels, filters, setFilters } = useMenuFilters();
  const menu = useMemo(() => (products === null ? null : filterMenu(products, filters)), [products, filters]);

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

  const addToCart = (product, modifiers = []) => {
    cart.add(product, modifiers);
    setChoosing(null);
    toast.success(`${product.title} añadido al carrito`, { toastId: `added-${product.id}` });
  };

  const addProduct = (product) => (hasModifiers(product) ? setChoosing(product) : addToCart(product));

  return (
    <>
      <Button as={Link} to={customerPath(token)} basic size="small">
        <Icon name="arrow left" /> Categorías
      </Button>
      <Header as="h2">{products?.[0]?.category_data?.title ?? "Productos"}</Header>
      <MenuFilters labels={labels} filters={filters} onChange={setFilters} />
      <ProductList
        products={menu?.products ?? null}
        onAdd={addProduct}
        emptyText={menu?.hidden ? "Ningún producto de esta categoría cumple los filtros." : undefined}
      />
      {menu?.hidden > 0 && <Message size="small" content={hiddenMessage(menu)} />}
      {products?.length > 0 && <p className="menu-allergen-notice">{ALLERGEN_NOTICE}</p>}
      <ModalBasic show={choosing !== null} onClose={() => setChoosing(null)} title={choosing?.title}>
        {choosing && <ModifierDialog product={choosing} onConfirm={(modifiers) => addToCart(choosing, modifiers)} />}
      </ModalBasic>
    </>
  );
}

const NO_PRODUCTS_TEXT = "No hay productos disponibles en esta categoría.";

export function ProductList({ products, onAdd, emptyText = NO_PRODUCTS_TEXT }) {
  if (products === null) {
    return (
      <Loader active inline="centered">
        Cargando productos...
      </Loader>
    );
  }
  if (!products.length) return <Message info content={emptyText} />;

  return (
    <Item.Group divided unstackable>
      {products.map((product) => (
        <Item key={product.id}>
          <Item.Image size="tiny" src={product.image} alt={product.title} />
          <Item.Content verticalAlign="middle">
            <Item.Header>{product.title}</Item.Header>
            <Item.Meta>
              {formatPrice(product.price)}
              <PreparationTime minutes={product.preparation_time} />
            </Item.Meta>
            {product.description && <Item.Description>{product.description}</Item.Description>}
            <ProductLabels product={product} />
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

function PreparationTime({ minutes }) {
  const text = menuPreparationText(minutes);
  return text && <span className="menu-preparation-time">{text}</span>;
}
