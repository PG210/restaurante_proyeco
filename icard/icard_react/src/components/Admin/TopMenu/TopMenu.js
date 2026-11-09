import React from "react";
import {Icon, Menu}  from "semantic-ui-react";

//importar los datos de usuario logeados
import { useAuth } from "../../../hooks";
import "./TopMenu.scss";

export function TopMenu(){
    //obtener los datos del usuario
    const {auth, logout} = useAuth();
    //console.log(auth);
    //validar si existe el nombre para retornarlo o de lo contrario retorna el email
    const renderName = () => {
      if(auth.me?.first_name && auth.me?.last_name){
         return `${auth.me.first_name} ${auth.me.last_name}`;
      }
      return auth.me?.email;
    }

    return (
      <Menu fixed="top" className="top-menu-admin">
        <Menu.Item className="top-menu-admin__logo">
          <p>Icard Admin</p>
        </Menu.Item>

        <Menu.Menu position="right">
          <Menu.Item>
            Hola, {renderName()}
          </Menu.Item>

          <Menu.Item onClick={logout}> {/* aqui la funcion para cerrar sesion */}
            <Icon name="sign-out"/> 
          </Menu.Item>

        </Menu.Menu>
      </Menu>


    )
}