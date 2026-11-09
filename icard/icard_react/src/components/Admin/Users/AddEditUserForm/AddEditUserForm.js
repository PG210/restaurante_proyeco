import React from "react";
import { Button, Checkbox, Form } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import "./AddEditUserForm.scss";
import { useUser } from "../../../../hooks";
import { ROLE_OPTIONS } from "../../../../utils/constants";
import { notifyError } from "../../../../utils/notify";

export function AddEditUSerForm({ onClose, onRefetch, user }) {
  const { addUser, updateUser } = useUser();

  const formik = useFormik({
    initialValues: initialValues(user),
    validationSchema: Yup.object(userSchema(Boolean(user))),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        if (user) await updateUser(user.id, formValue);
        else await addUser(formValue);
        onRefetch();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form className="add-edit-user-form" onSubmit={formik.handleSubmit}>
      <Form.Input
        name="username"
        placeholder="Nombre de usuario"
        value={formik.values.username}
        onChange={formik.handleChange}
        error={formik.errors.username}
      />
      <Form.Input
        name="email"
        placeholder="Correo electrónico"
        value={formik.values.email}
        onChange={formik.handleChange}
        error={formik.errors.email}
      />
      <Form.Input
        name="first_name"
        placeholder="Nombre"
        value={formik.values.first_name}
        onChange={formik.handleChange}
        error={formik.errors.first_name}
      />
      <Form.Input
        name="last_name"
        placeholder="Apellidos"
        value={formik.values.last_name}
        onChange={formik.handleChange}
        error={formik.errors.last_name}
      />
      <Form.Input
        name="password"
        type="password"
        placeholder={user ? "Nueva contraseña (opcional)" : "Contraseña"}
        value={formik.values.password}
        onChange={formik.handleChange}
        error={formik.errors.password}
      />
      <Form.Dropdown
        name="roles"
        placeholder="Roles"
        fluid
        multiple
        selection
        options={ROLE_OPTIONS}
        value={formik.values.roles}
        error={formik.errors.roles}
        onChange={(_, data) => formik.setFieldValue("roles", data.value)}
      />
      <div className="add-edit-user-form__active">
        <Checkbox
          toggle
          checked={formik.values.is_active}
          onChange={(_, data) => formik.setFieldValue("is_active", data.checked)}
        />{" "}
        Usuario Activo
      </div>
      <div className="add-edit-user-form__staff">
        <Checkbox
          toggle
          checked={formik.values.is_staff}
          onChange={(_, data) => formik.setFieldValue("is_staff", data.checked)}
        />{" "}
        Usuario Administrador
      </div>
      <Button type="submit" content={user ? "Actualizar" : "Crear"} primary fluid loading={formik.isSubmitting} />
    </Form>
  );
}

function initialValues(user) {
  return {
    username: user?.username || "",
    email: user?.email || "",
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    password: "",
    roles: user?.roles || [],
    is_active: Boolean(user?.is_active),
    is_staff: Boolean(user?.is_staff),
  };
}

function userSchema(isUpdate) {
  const password = Yup.string();
  return {
    username: Yup.string().required("El nombre de usuario es obligatorio"),
    email: Yup.string().email("Correo no válido").required("El email es obligatorio"),
    first_name: Yup.string(),
    last_name: Yup.string(),
    password: isUpdate ? password : password.required("La contraseña es obligatoria"),
    roles: Yup.array().of(Yup.string().oneOf(ROLE_OPTIONS.map((option) => option.value))),
    is_active: Yup.bool(),
    is_staff: Yup.bool(),
  };
}
