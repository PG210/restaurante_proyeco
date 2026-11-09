import React from "react";
import "./LoginAdmin.scss";
//importar los componentes de la carpeta components
import {LoginForm} from "../../../components/Admin"

export function LoginAdmin(){
    return (
        <div className="login-admin">
            <div className="login-admin__content">
                <h2>Iniciar Sesión Admin</h2>
                <LoginForm /> 
            </div>
        </div>
    )
}