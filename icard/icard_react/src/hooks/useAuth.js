import {useContext} from "react";
import {AuthContext} from "../context/AuthContext";

//export const useAuth = () => useContext(AuthContext); //se obtiene el valor del contexto

export function useAuth(){
    return useContext(AuthContext);
}
