import React, { useState, useContext } from "react";
import { useHistory, Link } from "react-router-dom";
import firebase from "../../../firebase";
import "firebase/auth";
import "firebase/firestore";
import { AuthContext } from "../../../AuthProvider";

import { Formik } from "formik";
import { Form as FormikForm } from "formik";
import FormField from "../../../components/FormFields/FormField";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import schema from "../../../schemas/signup.schema";

const SignUp = () => {
  const authContext = useContext(AuthContext);
  const history = useHistory();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // prettier-ignore
  const [alert, setAlert] = useState<{ show: boolean; type: string; messages: [string] }>({ show: false, type: "", messages: [""] });

  const handleSignup = (data: { email: string; password: string }) => {
    setIsSubmitting(true);
    // prettier-ignore

    firebase
      .auth()
      .createUserWithEmailAndPassword(data.email, data.password)
      .then((userCredential: firebase.auth.UserCredential) => {
        authContext.setUser(userCredential);
      })
      .catch((error) => {
        setIsSubmitting(false);
        setAlert({ show: true, type: "danger", messages: [error.message] });
        console.log(error.message);
      })
  };
  return (
    <div className="container py-4 text-center">
      <h1>Sign up</h1>
      <Formik
        validationSchema={schema}
        initialValues={{
          email: "",
          password: "",
        }}
        onSubmit={(data) => {
          handleSignup(data);
        }}
      >
        {() => (
          <FormikForm className="offset-md-3 col-md-6">
            {alert.show && (
              <div className={`alert alert-${alert.type} small`}>
                {alert.messages.map((message, index) => (
                  <div key={index}>{message}</div>
                ))}
              </div>
            )}
            <Form.Group>
              <FormField
                placeholder="Email Address"
                name="email"
                type="input"
              />
            </Form.Group>
            <Form.Group>
              <FormField
                placeholder="Password"
                name="password"
                type="password"
                autoComplete="new-password"
              />
            </Form.Group>
            {/* prettier-ignore */}
            <button disabled={isSubmitting} type="submit" className={`btn btn-primary btn-block`} >
              {isSubmitting ? (
                // prettier-ignore
                <> <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /><span className="sr-only">Loading...</span> </>
              ) : (
                "Sign Up"
              )}
            </button>
            {/* prettier-ignore */}
            <p className="small mt-2">Already registered? <Link to="/auth/login">Log in</Link></p>
          </FormikForm>
        )}
      </Formik>
    </div>
  );
};

export default SignUp;
