import React from "react";
import {LoginAdmin} from "../../pages/Admin"; // importar el loginadmin

import { useAuth } from "../../hooks"; //importar para que el usuario si esta logueado pase al panel

import "./AdminLayout.scss";

import { TopMenu, LateralMenu } from "../../components/Admin"; //menu superior y lateral


export function AdminLayout(props){
    const { children } = props;
    const { auth } = useAuth(); //variable de estado

    if(!auth ) {
         return <LoginAdmin />; //retornar el login admin
    }

    return (
        <div className="admin-layout">
            <div className="admin-layout__menu">
                <TopMenu/>
            </div>
            <div className="admin-layout__main-content">
                <LateralMenu>
                   {children}
                </LateralMenu>
            </div>
        </div>
    )
}