import React from "react";
import { Button } from "semantic-ui-react";
import "./HeaderPage.scss";

export function HeaderPage({ title, btnTitle, btnClick, btnTitleTwo, btnClickTwo }) {
  return (
    <div className="header-page-admin">
      <h2>{title}</h2>
      <div>
        {btnTitleTwo && (
          <Button basic onClick={btnClickTwo}>
            {btnTitleTwo}
          </Button>
        )}
        {btnTitle && (
          <Button positive onClick={btnClick}>
            {btnTitle}
          </Button>
        )}
      </div>
    </div>
  );
}
