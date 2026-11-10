import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Header, Image, Loader } from "semantic-ui-react";
import { customerApi } from "../../api/customer";
import { useCustomer } from "../../context/CustomerContext";
import { customerPath } from "../../utils/customerPaths";
import { notifyError } from "../../utils/notify";

export function CustomerMenu() {
  const { token, pauseOnThrottle } = useCustomer();
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    customerApi
      .getCategories()
      .then(setCategories)
      .catch((error) => {
        pauseOnThrottle(error);
        notifyError(error);
        setCategories([]);
      });
  }, [pauseOnThrottle]);

  if (categories === null) {
    return (
      <Loader active inline="centered">
        Cargando carta...
      </Loader>
    );
  }

  return (
    <>
      <Header as="h2">Nuestra carta</Header>
      <Card.Group itemsPerRow={2} doubling>
        {categories.map((category) => (
          <Card key={category.id} as={Link} to={customerPath(token, "category", { categoryId: category.id })}>
            <Image src={category.image} alt={category.title} wrapped ui={false} />
            <Card.Content>
              <Card.Header>{category.title}</Card.Header>
            </Card.Content>
          </Card>
        ))}
      </Card.Group>
    </>
  );
}
